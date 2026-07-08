const express = require('express');
require("dotenv").config();

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
  }
});


app.use(cors());
app.use(express.json());


console.log(
  "API KEY =",
  process.env.GOOGLE_MAPS_API_KEY
);













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

    console.log(
      "❌ Database Connection Failed",
      err
    );

  } else {

    console.log(
      "✅ Database Connected Successfully"
    );

    connection.release();

  }

});






















// ================= CONFIG =================

const PORT = 3000;
const HOST = "0.0.0.0";

// ================= SOCKET LIVE LOCATION =================


io.on("connection", (socket) => {

  console.log(
    "Driver Connected:",
    socket.id
  );

  socket.on(
    "driver_location",
    (data) => {


      const {
        vehicle_id,
        latitude,
        longitude
      } = data;

      if (!vehicle_id || !latitude || !longitude) {

        console.log(
          "Invalid Location"
        );

        return;

      }

      console.log("======================");

      console.log(
        "Vehicle:",
        vehicle_id
      );

      console.log(
        "Latitude:",
        latitude
      );

      console.log(
        "Longitude:",
        longitude
      );

      console.log(
        "Time:",
        new Date()
      );

      console.log("======================");


      db.query(

        `
INSERT INTO vehicle_locations
(
vehicle_id,
latitude,
longitude,
created_at
)

VALUES
(?,?,?,NOW())

`,

        [
          vehicle_id,
          latitude,
          longitude
        ],


        (err) => {


          if (err) {

            console.log(
              "Location Save Error:",
              err
            );


          } else {


            console.log(
              "✅ Location Saved"
            );


          }



        }

      );





      io.emit(
        "vehicle_live_update",
        data
      );



    });





  socket.on(
    "disconnect",
    () => {

      console.log(
        "Driver Disconnected",
        socket.id
      );

    }

  );



});







// ================= LOGIN =================


app.post('/login',
  async (req, res) => {


    const {
      username,
      password
    } = req.body;



    try {


      if (
        username === "admin" &&
        password === "1234"
      ) {


        return res.json({

          status: "success",

          role: "admin"

        });


      }






      const [rows] = await db.promise()
        .execute(

          `
SELECT
vehicle_id,
vehicle_number

FROM vehicles

WHERE username=?
AND password=?

`,

          [
            username,
            password
          ]


        );





      if (rows.length > 0) {


        return res.json({

          status: "success",

          role: "driver",

          data: rows[0]

        });


      }



      res.status(401).json({

        status: "fail",

        message: "Invalid credentials"

      });



    } catch (err) {


      res.status(500).json({

        status: "error",

        message: err.message

      });


    }


  });








// ================= ADD VEHICLE =================







// ================= GET VEHICLES =================


app.get('/api/vehicles',
  (req, res) => {


    db.query(

      "SELECT * FROM vehicles",

      (err, result) => {


        if (err) {

          return res.status(500).json({

            status: "error"

          });


        }



        res.json({

          status: "success",

          data: result


        });



      }


    );


  });




















// ================= DELETE VEHICLE =================


app.delete(
  '/delete-vehicle/:id',

  (req, res) => {


    db.query(

      `
DELETE FROM vehicles

WHERE vehicle_id=?

`,

      [
        req.params.id
      ],


      (err) => {


        if (err) {

          return res.status(500).json({

            status: "error"

          });

        }



        res.json({

          status: "success"

        });



      }


    );



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




































// ================= BULK ASSIGN SHOPS =================


app.post("/assign-vehicle-shops-bulk", (req, res) => {


  const {
    vehicle_id,
    shop_ids
  } = req.body;



  if (!vehicle_id || !Array.isArray(shop_ids)) {


    return res.status(400).json({

      status: "error",

      message: "Invalid data"

    });


  }



  const values = shop_ids.map(
    shop_id => [
      vehicle_id,
      shop_id
    ]
  );



  const sql = `

 INSERT INTO vehicle_shop_map
 (vehicle_id,shop_id)

 VALUES ?

 ON DUPLICATE KEY UPDATE
 vehicle_id = VALUES(vehicle_id)

 `;



  db.query(
    sql,
    [values],

    (err) => {


      if (err) {

        console.log(err);

        return res.status(500).json({
          status: "error"
        });

      }



      res.json({

        status: "success",

        message: "Shops assigned"

      });


    });


});















// ================= ADD SHOP =================


app.post("/api/add-shop", async (req,res)=>{

try {

const {
name,
owner_name,
address,
phone,
whatsapp,
agreement_start,
agreement_period,
agreement_type,
collection_frequency,
collection_days,
collection_time,
notes

}=req.body;


console.log("COLLECTION DAYS:", collection_days);


    console.log(
      "Collection Days:",
      collection_days
    );

    console.log(
      "Collection Time:",
      collection_time
    );




    if (!name || !address || !phone) {


      return res.status(400).json({

        status: "error",

        message: "Missing required fields"

      });


    }







    // ================= GEOCODE =================


    const geoResponse = await axios.get(

      "https://maps.googleapis.com/maps/api/geocode/json",

      {

        params: {

          address,

          key: process.env.GOOGLE_MAPS_API_KEY

        }

      }

    );





    if (geoResponse.data.status !== "OK") {


      return res.status(400).json({

        status: "error",

        message: "Invalid address"

      });


    }




    const location =
      geoResponse.data.results[0]
        .geometry.location;



    const lat = location.lat;

    const lng = location.lng;









    // ================= AGREEMENT END =================


    let agreement_end = null;



    if (
      agreement_start &&
      agreement_period &&
      agreement_type
    ) {


      const start = new Date(
        agreement_start
      );



      if (agreement_type === "Month") {


        start.setMonth(
          start.getMonth() + Number(agreement_period)
        );


      }

      else {


        start.setFullYear(
          start.getFullYear() + Number(agreement_period)
        );


      }



      agreement_end =
        start.toISOString()
          .split("T")[0];



    }








    // ================= INSERT SHOP =================


    const sql = `

INSERT INTO shops

(

shop_name,
owner_name,
address,
phone,
whatsapp,
lat,
lng,
agreement_start,
agreement_end,
agreement_period,
agreement_type,
collection_frequency,
collection_time,
notes

)


VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)

`;





    db.query(

      sql,

      [

        name,
        owner_name,
        address,
        phone,
        whatsapp,
        lat,
        lng,
        agreement_start,
        agreement_end,
        agreement_period,
        agreement_type,
        collection_frequency,
        collection_time,
        notes


      ],


      (err, result) => {


        if (err) {


          console.log(err);


          return res.status(500).json({

            status: "error",

            message: err.message

          });


        }



        const shopId = result.insertId;





console.log("====== SCHEDULE DEBUG ======");
console.log("Shop ID:", shopId);
console.log("Days:", collection_days);
console.log("Start:", agreement_start);
console.log("End:", agreement_end);
console.log("Time:", collection_time);
console.log("============================");

        // COLLECTION DAYS SAVE

  if (collection_days && collection_days.length > 0) {


const values =
collection_days.map(day => [

shopId,
day

]);


db.query(
`
INSERT INTO shop_collection_days
(shop_id,day_name)
VALUES ?
`,
[values]
);














          // ================= CREATE COLLECTION SCHEDULE =================


          const weekDays = [

            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"

          ];


          const startDate = agreement_start

            ? new Date(agreement_start)

            : new Date();

          const endDate = agreement_end

            ? new Date(agreement_end)

            : new Date(

              startDate.getFullYear(),

              startDate.getMonth() + 1,

              startDate.getDate()

            );


          let currentDate = new Date(startDate);

          let scheduleValues = [];
          while (currentDate <= endDate) {

            const currentDay =

              weekDays[currentDate.getDay()];





            if (collection_days.includes(currentDay)) {



              const formattedDate =

                currentDate.getFullYear()

                +

                "-"

                +

                String(
                  currentDate.getMonth() + 1
                ).padStart(2, "0")

                +

                "-"

                +

                String(
                  currentDate.getDate()
                ).padStart(2, "0");





              scheduleValues.push([


                shopId,

                null,

                formattedDate,

                collection_time,

                "Pending"


              ]);



            }




            currentDate.setDate(

              currentDate.getDate() + 1

            );



          }

          console.log("==============================");

          console.log("Creating Collection Schedule");

          console.log("Shop ID :", shopId);

          console.log("Days :", collection_days);

          console.log("Time :", collection_time);

          console.log("Total :", scheduleValues.length);

          console.log("==============================");







console.log(
"GENERATED SCHEDULE VALUES:",
scheduleValues
);

          // ================= INSERT SCHEDULE =================


          if (scheduleValues.length > 0) {


            db.query(

              `

INSERT INTO collection_schedule

(

shop_id,

vehicle_id,

collection_date,

collection_time,

status

)

VALUES ?

`,

              [

                scheduleValues

              ],


              (err) => {


                if (err) {


                  console.log(
                    "❌ Schedule Insert Error:",
                    err
                  );



                }

                else {


                  console.log(
                    "✅ Collection Schedule Created Successfully"
                  );



                }



              }


            );



          }



        }





        return res.json({

          status: "success",

          shop_id: shopId,

          lat,

          lng,

          agreement_end


        });





      }

    );



  }

  catch (error) {


    console.log(error);


    res.status(500).json({

      status: "error",

      message: error.message

    });


  }


});












// ================= GET SHOPS =================


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

ON s.shop_id=vsm.shop_id


`;





  db.query(

    sql,

    (err, results) => {


      if (err) {


        console.error(
          "❌ Get shops error:",
          err
        );


        return res.status(500).json({

          status: "error",

          message: "Database query failed"

        });


      }





      const cleaned = results.map(shop => ({


        ...shop,



        vehicle_id:

          shop.vehicle_id !== null &&

            shop.vehicle_id !== undefined &&

            shop.vehicle_id !== ""


            ?

            Number(shop.vehicle_id)

            :

            null,





        is_collected:

          shop.is_collected === 1 ||

          shop.is_collected === "1" ||

          shop.is_collected === true



      }));





      res.json({

        status: "success",

        data: cleaned

      });



    }


  );



});












// ================= ACTIVE TASK SUMMARY =================


app.get('/api/active-task-summary', (req, res) => {



  const sql = `


SELECT


COUNT(DISTINCT v.vehicle_id)
AS activeVehicles,


COUNT(vsm.shop_id)
AS totalAssigned,



SUM(

CASE

WHEN s.is_collected=1

THEN 1

ELSE 0

END

)

AS completed,





SUM(

CASE

WHEN s.is_collected=0

THEN 1

ELSE 0

END

)

AS pending




FROM vehicles v



LEFT JOIN vehicle_shop_map vsm

ON v.vehicle_id=vsm.vehicle_id



LEFT JOIN shops s

ON s.shop_id=vsm.shop_id



`;





  db.query(

    sql,

    (err, result) => {


      if (err) {


        return res.status(500).json({

          status: "error",

          message: err.message

        });


      }




      res.json({

        status: "success",

        data: result[0]

      });



    }



  );



});












// ================= ACTIVE VEHICLE TASKS =================


app.get('/api/active-tasks', (req, res) => {



  const sql = `


SELECT


v.vehicle_id,

v.vehicle_number,

COUNT(s.shop_id)

AS total_shops,



SUM(

CASE

WHEN s.is_collected=1

THEN 1

ELSE 0

END

)

AS completed



FROM vehicles v



LEFT JOIN vehicle_shop_map vsm

ON v.vehicle_id=vsm.vehicle_id



LEFT JOIN shops s

ON s.shop_id=vsm.shop_id



GROUP BY v.vehicle_id



`;





  db.query(

    sql,

    (err, result) => {


      if (err) {


        return res.status(500).json({

          status: "error"

        });


      }



      res.json({

        status: "success",

        data: result

      });



    }



  );



});











// ================= TODAY COLLECTION =================


app.get('/api/today-collection', (req, res) => {


  const today = new Date()

    .toISOString()

    .split("T")[0];





  db.query(

    `

SELECT SUM(total) AS amount

FROM transactions

WHERE DATE(timestamp)=?

AND action='Collect Cash'

`,

    [today],


    (err, result) => {


      if (err) {


        return res.status(500).json({

          status: "error"

        });


      }




      res.json({

        amount:

          result[0].amount || 0

      });



    }


  );



});
// ================= ASSIGN SHOPS =================

app.post("/assign-vehicle-shops", (req, res) => {


  const {
    vehicle_id,
    shop_id
  } = req.body;



  const checkSql =

    "SELECT 1 FROM vehicle_shop_map WHERE vehicle_id=? AND shop_id=?";



  db.query(

    checkSql,

    [vehicle_id, shop_id],

    (err, result) => {


      if (err)

        return res.status(500).json({
          status: "error"
        });




      if (result.length > 0) {

        return res.json({
          status: "exists"
        });

      }




      db.query(

        "INSERT INTO vehicle_shop_map (vehicle_id,shop_id) VALUES (?,?)",

        [vehicle_id, shop_id],

        (err2) => {


          if (err2)

            return res.status(500).json({
              status: "error"
            });



          res.json({
            status: "success"
          });


        }


      );



    }



  );



});









// ================= VEHICLE SHOPS =================


app.get("/get-vehicle-shops/:vehicle_id", (req, res) => {


  const sql = `

SELECT s.*

FROM shops s

INNER JOIN vehicle_shop_map vsm

ON s.shop_id=vsm.shop_id

WHERE vsm.vehicle_id=?

`;



  db.query(

    sql,

    [req.params.vehicle_id],

    (err, results) => {


      if (err)

        return res.status(500).json({
          status: "error"
        });



      res.json({

        status: "success",

        data: results

      });


    }


  );



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



  console.log(
    "Saving transaction for Vehicle ID:",
    vehicleId
  );





  db.query(

    `

INSERT INTO transactions

(

shop_id,

shop_name,

action,

total,

breakdown,

timestamp,

vehicle_id

)

VALUES (?,?,?,?,?,?,?)

`,

    [

      shopId,

      shopName,

      action,

      total,

      JSON.stringify(breakdown),

      new Date(timestamp),

      vehicleId

    ],


    (err) => {


      if (err)

        return res.status(500).json({
          success: false
        });




      db.query(

        "UPDATE shops SET is_collected=? WHERE shop_id=?",

        [

          isCollected ? 1 : 0,

          shopId

        ]

      );



      res.json({

        success: true

      });



    }



  );



});













// ================= GET LAST TRANSACTION =================


app.get('/api/get-last-transaction/:shopId', (req, res) => {


  const shopId = req.params.shopId;

  const action = req.query.action;



  const checkShopStatusSql =

    "SELECT is_collected FROM shops WHERE shop_id=?";





  db.query(

    checkShopStatusSql,

    [shopId],

    (err, shopResults) => {


      if (err || shopResults.length === 0) {


        return res.status(500).json({

          success: false,

          message: "Shop not found"

        });


      }



      const isCollected =
        shopResults[0].is_collected;





      if (isCollected === 0) {


        return res.json({

          success: true,

          transaction: null

        });


      }





      const sql = `

SELECT *

FROM transactions

WHERE shop_id=?

AND action=?

ORDER BY timestamp DESC

LIMIT 1

`;





      db.query(

        sql,

        [shopId, action],

        (err, results) => {


          if (err)

            return res.status(500).json({
              success: false
            });




          if (results.length === 0) {

            return res.json({

              success: true,

              transaction: null

            });

          }




          let transaction = results[0];



          try {


            transaction.breakdown =

              JSON.parse(
                transaction.breakdown || "{}"
              );


          }

          catch (e) {

            transaction.breakdown = {};

          }



          res.json({

            success: true,

            transaction

          });


        }


      );



    }



  );



});














// ================= UPDATE LOCATION =================


app.post('/update-location', (req, res) => {


  const {

    vehicle_id,

    latitude,

    longitude

  } = req.body;



  const sql =

    `

INSERT INTO vehicle_locations

(vehicle_id,latitude,longitude,created_at)

VALUES (?,?,?,NOW())

`;





  db.query(

    sql,

    [

      vehicle_id,

      latitude,

      longitude

    ],

    (err) => {


      if (err)

        return res.status(500).send(
          "Database error"
        );





      io.emit(

        `vehicle_${vehicle_id}_update`,

        {

          latitude,

          longitude

        }

      );





      res.send({

        success: true

      });



    }


  );



});












// ================= GET ROUTE =================


app.get('/api/get-route/:vehicleId', (req, res) => {


  db.query(

    `

SELECT latitude,longitude

FROM vehicle_locations

WHERE vehicle_id=?

ORDER BY id ASC

`,

    [req.params.vehicleId],

    (err, results) => {


      if (err)

        return res.status(500).json({
          success: false
        });



      res.json({

        success: true,

        data: results

      });


    }



  );



});













// ================= GET LATEST VEHICLE LOCATION =================


app.get('/api/get-vehicle-location/:vehicleId', (req, res) => {


  const sql = `

SELECT latitude,longitude

FROM vehicle_locations

WHERE vehicle_id=?

ORDER BY id DESC

LIMIT 1

`;



  db.query(

    sql,

    [req.params.vehicleId],

    (err, result) => {


      if (err)

        return res.status(500).json({
          success: false
        });



      if (result.length === 0)

        return res.json(null);



      res.json(result[0]);


    }



  );



});












// ================= DELETE SHOP =================


app.delete("/delete-shop/:id", (req, res) => {


  const shopId = req.params.id;



  db.query(

    "DELETE FROM vehicle_shop_map WHERE shop_id=?",

    [shopId],

    (err) => {


      if (err)

        return res.status(500).json({

          status: "error",

          message: err.message

        });





      db.query(

        "DELETE FROM shops WHERE shop_id=?",

        [shopId],

        (err2) => {


          if (err2)

            return res.status(500).json({

              status: "error",

              message: err2.message

            });




          res.json({

            status: "success"

          });


        }



      );



    }



  );



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

shop_name=?,

address=?,

phone=?,

lat=?,

lng=?,

status=?

WHERE shop_id=?

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

SELECT SUM(total) AS total_sum

FROM transactions

WHERE shop_id IN

(

SELECT shop_id

FROM vehicle_shop_map

WHERE vehicle_id=?

)

`;




  const sqlLoc = `

SELECT latitude,longitude

FROM vehicle_locations

WHERE vehicle_id=?

ORDER BY id DESC

LIMIT 1

`;




  db.query(

    sqlTotal,

    [vId],

    (err, sumRes) => {


      db.query(

        sqlLoc,

        [vId],

        (err2, locRes) => {


          res.json({

            total_sum:

              sumRes[0].total_sum || 0,


            location:

              locRes.length > 0

                ?

                locRes[0]

                :

                null


          });


        }



      );



    }



  );



});












// ================= ADMIN TOTAL =================


app.get('/api/admin/get-total-collected', async (req, res) => {


  try {


    const today =

      new Date()

        .toISOString()

        .split('T')[0];





    const [result] = await db.promise().query(

      `

SELECT SUM(total) AS grandTotal

FROM transactions

WHERE DATE(timestamp)=?

`,

      [today]

    );




    res.json({

      grandTotal:

        result[0].grandTotal || 0

    });



  }

  catch (e) {


    res.status(500).json({

      error: e.message

    });


  }



});













// ================= VEHICLE FINANCIALS =================


app.get('/api/vehicle-financials/:vehicleId', (req, res) => {


  const vehicleId = req.params.vehicleId;



  const sql = `

SELECT


SUM(

CASE

WHEN action='Collect Cash'

THEN total

ELSE 0

END

) AS total_collected,




SUM(

CASE

WHEN action='Pay Cash'

THEN total

ELSE 0

END

) AS total_payable



FROM transactions

WHERE vehicle_id=?


`;





  db.query(

    sql,

    [vehicleId],

    (err, result) => {


      if (err) {

        console.log(err);

        return res.status(500).send(err);

      }




      res.json(result[0]);


    }



  );



});












// ================= ADD MANUAL SCHEDULE =================


app.post("/api/add-schedule", (req, res) => {


  const {

    shop_id,

    vehicle_id,

    collection_date,

    collection_time

  } = req.body;




  const sql = `

INSERT INTO collection_schedule

(

shop_id,

vehicle_id,

collection_date,

collection_time,

status

)

VALUES

(?,?,?,?, 'Pending')

`;




  db.query(

    sql,

    [

      shop_id,

      vehicle_id,

      collection_date,

      collection_time

    ],


    (err) => {


      if (err) {

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












// ======================================
// CALENDAR SHOPS
// ======================================


app.get("/api/calendar-shops", (req, res) => {


  const sql = `

SELECT

cs.schedule_id,
cs.collection_date,
cs.status,
cs.vehicle_id,

s.shop_id,
s.shop_name,
s.address,
s.phone,
s.lat,
s.lng

FROM collection_schedule cs

INNER JOIN shops s
ON cs.shop_id=s.shop_id

ORDER BY cs.collection_date ASC


`;





  db.query(

    sql,

    (err, results) => {


      if (err) {


        return res.status(500).json({

          status: "error",

          message: err.message

        });



      }



      res.json({

        status: "success",

        data: results

      });



    }



  );



});












// ================= CALENDAR BY DATE =================


app.get("/api/calendar/:date", (req, res) => {

  const date = req.params.date;

  const sql = `
SELECT
    cs.schedule_id,
    cs.collection_date,
    cs.status,
    cs.vehicle_id,
    s.shop_id,
    s.shop_name,
    s.address,
    s.phone,
    s.lat,
    s.lng
FROM collection_schedule cs
INNER JOIN shops s
    ON cs.shop_id = s.shop_id
WHERE cs.collection_date = ?
ORDER BY s.shop_name
`;









 
  db.query(sql, [date], (err, results) => {

    if (err) {
      console.log(err);

      return res.status(500).json({
        status: "error",
        message: err.message,
      });
    }




   
    res.json({
      status: "success",
      data: results,
    });
  });
});












// ================= ROOT TEST =================


app.get('/', (req, res) => {


  res.status(200).send(

    'Cash Collector Backend is Running!'

  );


});









// ================= EXPORT =================


module.exports = app;









// ================= START SERVER =================

// Local run only

if (require.main === module) {


  server.listen(

    PORT,

    HOST,

    () => {


      console.log(

        `Server running on http://${HOST}:${PORT}`

      );


    }


  );


}
