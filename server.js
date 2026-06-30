const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }});

app.use(cors());
app.use(express.json());


// ================= DATABASE =================
const db = mysql.createPool({
  host: 'payslip.lk',
  user: 'meadhavi',
  password: 'Me@@#2026',
  database: 'delivery',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("❌ Database Connection Failed", err);
  } else {
    console.log("✅ Database Connected Successfully");
    connection.release();
  }
});

// ================= CONFIG =================
const PORT = 3000;
const HOST = "0.0.0.0";


 //SOCKET REAL-TIME TRACKING (UBER STYLE CORE)

io.on("connection", (socket) => {
  console.log(" Driver connected:", socket.id);

  socket.on("driver_location", (data) => {
    const { vehicle_id, latitude, longitude } = data;

    if (!vehicle_id || !latitude || !longitude) {
      console.log(" Invalid location data");
      return;
    }


    console.log("====================================");
    console.log(" LIVE VEHICLE LOCATION");
    console.log("Vehicle ID :", vehicle_id);
    console.log("Latitude   :", latitude);
    console.log("Longitude  :", longitude);
    console.log("Time       :", new Date().toLocaleString());
    console.log("====================================");


    db.query(
      `INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, created_at)
       VALUES (?, ?, ?, NOW())`,
      [vehicle_id, latitude, longitude],
      (err) => {
        if (err) {
          console.log(" DB Error:", err.message);
        } else {
          console.log(" Saved to vehicle_locations table");
        }
      }
    );


    io.emit("vehicle_live_update", data);
  });

  socket.on("disconnect", () => {
    console.log(" Driver disconnected:", socket.id);
  });
});
// ================= LOGIN =================
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // admin login
    if (username === 'admin' && password === '1234') {
      return res.json({ status: 'success', role: 'admin' });
    }

    const [rows] = await db.promise().execute(
      'SELECT vehicle_id, vehicle_number FROM vehicles WHERE username = ? AND password = ?',
      [username, password]
    );

    if (rows.length > 0) {
      return res.json({
        status: 'success',
        role: 'driver',
        data: rows[0]
      });
    }

    res.status(401).json({ status: 'fail', message: 'Invalid credentials' });

  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= VEHICLES =================
app.post('/add-vehicle', (req, res) => {

  const {
    vehicle_number,
    vehicle_model,
    username,
    password
  } = req.body;

  const sql = `
    INSERT INTO vehicles
    (vehicle_number, vehicle_model, username, password)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      vehicle_number,
      vehicle_model,
      username,
      password
    ],
    (err, result) => {

      if (err) {
        console.log(err);

        return res.status(500).json({
          status: "error",
          message: err.message
        });
      }

      res.json({
        status: "success",
        vehicle_id: result.insertId
      });
    }
  );
});

app.get('/api/vehicles', (req, res) => {
  db.query("SELECT * FROM vehicles", (err, results) => {
    if (err) return res.status(500).json({ status: 'error' });

    res.json({ status: 'success', data: results });
  });
});

app.delete('/delete-vehicle/:id', (req, res) => {
  db.query("DELETE FROM vehicles WHERE vehicle_id = ?", [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ status: 'error' });

      res.json({ status: 'success' });
    }
  );
});




// ================= BULK ASSIGN SHOPS =================
// ================= BULK ASSIGN SHOPS (FIXED) =================
app.post("/assign-vehicle-shops-bulk", (req, res) => {
  const { vehicle_id, shop_ids } = req.body;

  if (!vehicle_id || !Array.isArray(shop_ids)) {
    return res.status(400).json({ status: "error", message: "Invalid data" });
  }

  const values = shop_ids.map(shop_id => [vehicle_id, shop_id]);

  // මෙතන ON DUPLICATE KEY UPDATE එක පිටුපස vehicle_id = VALUES(vehicle_id) ලෙස වෙනස් කර ඇත
  const sql = `
    INSERT INTO vehicle_shop_map (vehicle_id, shop_id)
    VALUES ?
    ON DUPLICATE KEY UPDATE vehicle_id = VALUES(vehicle_id)
  `;

  db.query(sql, [values], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ status: "error" });
    }

    res.json({ status: "success", message: "Shops assigned" });
  });
});


// ================= SHOPS =================
 // මෙය ඔබේ ගොනුවේ ඉහළින්ම ඇතුළත් කරන්න

app.post('/api/add-shop', async (req, res) => {
  const { name, address, phone } = req.body;
  const API_KEY = 'AIzaSyAC1wMXxyCpYVtaBGbGjdmEx_I7j_M0H1A';

  try {
    // 1. Google Maps API එක හරහා Geocoding සිදු කිරීම
    const geoResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        address: address,
        key: API_KEY
      }
    });

    // ලිපිනය නිවැරදිදැයි පරීක්ෂා කිරීම
    if (!geoResponse.data.results || geoResponse.data.results.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Address not found' });
    }

    const { lat, lng } = geoResponse.data.results[0].geometry.location;

    // 2. Database එකට දත්ත ඇතුළත් කිරීම
    db.query(
      `INSERT INTO shops (shop_name, address, lat, lng, phone) VALUES (?, ?, ?, ?, ?)`,
      [name, address, lat, lng, phone],
      (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ status: 'error', message: err.message });
        }

        console.log("Shop added with coordinates:", lat, lng);
        res.json({
          status: 'success',
          shop_id: result.insertId,
          lat: lat,
          lng: lng
        });
      }
    );
  } catch (error) {
    console.error("Geocoding Error:", error.message);
    res.status(500).json({ status: 'error', message: 'Geocoding service failed' });
  }
});


//===== Get Shop (Updated with s.is_collected) =====//
app.get('/get-shops', (req, res) => {
const sql = `
SELECT 
  s.shop_id,
  s.shop_name,
  s.address,
  s.phone,
  s.lat,
  s.lng,
  s.is_collected,
  vsm.vehicle_id
FROM shops s
LEFT JOIN vehicle_shop_map vsm 
ON s.shop_id = vsm.shop_id
`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Get shops error:", err);
      return res.status(500).json({ 
        status: 'error',
        message: 'Database query failed'
      });
    }

    // ===== CLEAN DATA BEFORE SENDING =====
    const cleaned = results.map(shop => ({
      ...shop,
      vehicle_id:
        shop.vehicle_id !== null &&
        shop.vehicle_id !== undefined &&
        shop.vehicle_id !== ""
          ? Number(shop.vehicle_id)
          : null,

      is_collected:
        shop.is_collected === 1 ||
        shop.is_collected === "1" ||
        shop.is_collected === true
    }));

    return res.json({
      status: 'success',
      data: cleaned
    });
  });
});


// ================= ASSIGN SHOPS =================
app.post("/assign-vehicle-shops", (req, res) => {
  const { vehicle_id, shop_id } = req.body;

  const checkSql =
    "SELECT 1 FROM vehicle_shop_map WHERE vehicle_id = ? AND shop_id = ?";

  db.query(checkSql, [vehicle_id, shop_id], (err, result) => {
    if (err) return res.status(500).json({ status: "error" });

    if (result.length > 0) {
      return res.json({ status: "exists" });
    }

    db.query(
      "INSERT INTO vehicle_shop_map (vehicle_id, shop_id) VALUES (?, ?)",
      [vehicle_id, shop_id],
      (err2) => {
        if (err2) return res.status(500).json({ status: "error" });

        res.json({ status: "success" });
      }
    );
  });
});

// ================= VEHICLE SHOPS =================
app.get("/get-vehicle-shops/:vehicle_id", (req, res) => {
  const sql = `
    SELECT s.*
    FROM shops s
    INNER JOIN vehicle_shop_map vsm
    ON s.shop_id = vsm.shop_id
    WHERE vsm.vehicle_id = ?
  `;

  db.query(sql, [req.params.vehicle_id], (err, results) => {
    if (err) return res.status(500).json({ status: "error" });

    res.json({ status: "success", data: results });
  });
});

// ================= TRANSACTIONS =================
app.post('/api/save-transaction', (req, res) => {
const {
  shopId,
  shopName,
  action,
  total,
  breakdown,
  timestamp,
  isCollected,
  vehicleId
} = req.body;

console.log("Saving transaction for Vehicle ID:", vehicleId);

  db.query(
    `INSERT INTO transactions
     (shop_id, shop_name, action, total, breakdown, timestamp, vehicle_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
       [
          shopId,
          shopName,
          action,
          total,
          JSON.stringify(breakdown),
          new Date(timestamp),
          vehicleId
        ],
    (err, result) => {
      if (err) return res.status(500).json({ success: false });

      db.query(
        "UPDATE shops SET is_collected=? WHERE shop_id=?",
        [isCollected ? 1 : 0, shopId]
      );

      res.json({ success: true });
    }
  );
});

// ================= GET LAST TRANSACTION =================
app.get('/api/get-last-transaction/:shopId', (req, res) => {
  const shopId = req.params.shopId;
  const action = req.query.action;

  // මෙතනදී අපි මුලින්ම බලන්න ඕනේ සාප්පුවේ is_collected එක මොකක්ද කියලා
  const checkShopStatusSql = "SELECT is_collected FROM shops WHERE shop_id = ?";

  db.query(checkShopStatusSql, [shopId], (err, shopResults) => {
    if (err || shopResults.length === 0) {
      return res.status(500).json({ success: false, message: "Shop not found" });
    }

    const isCollected = shopResults[0].is_collected;

    // සාප්පුව Collected නැත්නම් (0 නම්) කිසිදු ගනුදෙනුවක් පෙන්වන්න එපා
    if (isCollected === 0) {
      return res.json({ success: true, transaction: null });
    }

    // සාප්පුව Collected නම් (1 නම්) පමණක් අන්තිම ගනුදෙනුව අදින්න
    const sql = `
      SELECT * FROM transactions
      WHERE shop_id = ? AND action = ?
      ORDER BY timestamp DESC LIMIT 1
    `;

    db.query(sql, [shopId, action], (err, results) => {
      if (err) return res.status(500).json({ success: false });

      if (results.length === 0) {
        return res.json({ success: true, transaction: null });
      }

      let transaction = results[0];
      try {
        transaction.breakdown = JSON.parse(transaction.breakdown || "{}");
      } catch (e) { transaction.breakdown = {}; }

      res.json({ success: true, transaction: transaction });
    });
  });
});




//==== updaet Locasion====//
app.post('/update-location', (req, res) => {

    const { vehicle_id, latitude, longitude } = req.body;

    console.log("Received data:", req.body);
    console.log(vehicle_id);
    console.log(latitude);
    console.log(longitude);



const sql = "INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, created_at) VALUES (?, ?, ?, NOW())";

    db.query(sql, [vehicle_id, latitude, longitude], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).send("Database error");
        }
        console.log("Data inserted successfully!");
        res.send({ success: true });
    });
});
// ================= GET ROUTE =================
app.get('/api/get-route/:vehicleId', (req, res) => {
  db.query(
    `SELECT latitude, longitude
     FROM vehicle_locations
     WHERE vehicle_id=?
     ORDER BY id ASC`,
    [req.params.vehicleId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false });

      res.json({ success: true, data: results });
    }
  );
});
// ================= GET LATEST VEHICLE LOCATION =================
app.get('/api/get-vehicle-location/:vehicleId', (req, res) => {

  const vehicleId = req.params.vehicleId;

  const sql = `
    SELECT latitude, longitude
    FROM vehicle_locations
    WHERE vehicle_id = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sql, [vehicleId], (err, result) => {

    if (err) {
      return res.status(500).json({
        success: false
      });
    }

    if (result.length === 0) {
      return res.json(null);
    }

    res.json(result[0]);
  });
});
// ================= UPDATE SHOP =================
app.put("/update-shop/:id", (req, res) => {

    const id = req.params.id;

    const {
        shop_name,
        address,
        phone,
        lat,
        lng,
        status
    } = req.body;

    const sql = `
        UPDATE shops
        SET
            shop_name = ?,
            address = ?,
            phone = ?,
            lat = ?,
            lng = ?,
            status = ?
        WHERE shop_id = ?
    `;

    db.query(
        sql,
        [
            shop_name,
            address,
            phone,
            lat,
            lng,
            status,
            id
        ],
        (err) => {

            if (err) {
                console.log(err);
                return res.status(500).json({
                    status: "error",
                    message: err.message
                });
            }

            res.json({
                status: "success"
            });

        }
    );

});
// ================= VEHICLE STATUS =================
app.get('/api/admin/vehicle-status/:vehicleId', (req, res) => {
  const vId = req.params.vehicleId;

  const sqlTotal = `
    SELECT SUM(total) as total_sum
    FROM transactions
    WHERE shop_id IN (
      SELECT shop_id FROM vehicle_shop_map WHERE vehicle_id = ?
    )
  `;

  const sqlLoc = `
    SELECT latitude, longitude
    FROM vehicle_locations
    WHERE vehicle_id = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sqlTotal, [vId], (err, sumRes) => {
    db.query(sqlLoc, [vId], (err2, locRes) => {
      res.json({
        total_sum: sumRes[0].total_sum || 0,
        location: locRes.length > 0 ? locRes[0] : null
      });
    });
  });
});

// ================= ADMIN TOTAL =================
app.get('/api/admin/get-total-collected', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [result] = await db.promise().query(
      "SELECT SUM(total) as grandTotal FROM transactions WHERE DATE(timestamp) = ?",
      [today]
    );

    res.json({ grandTotal: result[0].grandTotal || 0 });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
//===== vehical financials====//
app.get('/api/vehicle-financials/:vehicleId', (req, res) => {

    const vehicleId = req.params.vehicleId;

    const sql = `
        SELECT
            SUM(CASE WHEN action = 'Collect Cash' THEN total ELSE 0 END) as total_collected,
            SUM(CASE WHEN action = 'Pay Cash' THEN total ELSE 0 END) as total_payable
        FROM transactions
        WHERE vehicle_id = ?
    `;

    db.query(sql, [vehicleId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send(err);
        }

        res.json(result[0]);
    });
});
// ================= START SERVER =================
module.exports = app;


app.get('/', (req, res) => {
  res.status(200).send('Cash Collector Backend is Running!');
});
