const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const { getSessionToken } = require('../../utils/session')
const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }
  console.log("hi", sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userid",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleid",
      "se_project.roles.id"
    )
    .first();

  console.log("user =>", user);
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  console.log("user =>", user)
  return user;
};

module.exports = function (app) {
  // example
  app.get("/users", async function (req, res) {
    try {
      const user = await getUser(req);
      const users = await db.select('*').from("se_project.users")

      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }

  });

async function calculateTicketPrice(originId, destinationId) {
  try {
    // Retrieve the route between the origin and destination
    const route = await db('se_project.routes').where('fromStationid', originId).where('toStationid', destinationId).first();

    if (!route) {
      return null; // Route not found
    }

    // Retrieve the station routes for the given route
    const stationRoutes = await db('se_project.stationRoutes').select('stationid').where('routeid', route.id);

    // Construct an array of visited stations including the origin and destination
    const visitedStations = [originId, destinationId];
    stationRoutes.forEach(stationRoute => visitedStations.push(stationRoute.stationid));

    // Retrieve the prices for the visited stations
    const prices = await db('se_project.stations').whereIn('id', visitedStations).pluck('price');

    // Sum up the prices to calculate the ticket price
    const ticketPrice = prices.reduce((acc, price) => acc + price, 0);

    return ticketPrice;
  } catch (error) {
    throw error;
  }
}

  app.put("/api/v1/password/reset", async function (req, res) {

    const { newpassword } = req.body;
    //uses session id to get the user
    const user = await getUser(req);
    //check that the user exists
    if (!user) {
      return res.status(400).send("User not found")
    }
    const { userid } = user
    try {
      await db('se_project.users').where('id', userid).update({ password: newpassword });
      console.log('Password updated successfully.');
      await db.destroy();
      return res.status(200).send("Password updated successfully.");
    } catch (error) {
      console.error('Error updating password:', error);
      await db.destroy();
      return res.status(400).send("Something went wrong! Please try again later.");
    }
  })
  app.put("/api/v1/route/:routeId", async function(req, res){
    const user = await getUser(req)
    if (!user){
      return res.status(400).send("User not found")
    }

    if (!user.admin){
      return res.status(400).send("you are not an admin")
    }

    const name = req.body.routeName
    const routeID = req.param['routeId']

    try {
      await db('statise_project.routes').where('id', routeID).update({ routename: name });
      console.log('Route name updated successfully!');
    } catch (error) {
      console.error('Error updating route name:', error);
    } finally {
      // Close the database connection
      db.destroy();
    }
    
  })

  app.delete('/api/v1/station/:stationId', async function (req, res){
    const user = await getUser(req)
    if (!user) {
      return res.status(400).send("User not found")
    }
    if (!user.admin) {
      return res.status(400).send("you are not an admin")
    }

    const stationid = req.params.stationId;
    const poss = await db('se_project.stations').select('stationposition').where('id', stationid).first();
    const type = await db('se_project.stations').select('stationtype').where('id', stationid).first();
    if (poss == "start"){
      const tostation = await db('se_project.routes').select('toStationid').where('fromStationid', stationid).first();
      try {
        await db('se_project.stations').where('id', tostation.id).update({ stationposition: "start" });
        console.log('station possision updated successfully.');
        await db.destroy();
      } catch (error) {
        console.error('Error updating station possision:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.");
      }


    }else{
      if (poss == "end"){
        const fromstation = await db('se_project.routes').select('fromStationid').where('toStationid', stationid).first();
        try {
          await db('se_project.stations').where('id', fromstation.id).update({ stationposition: "end" });
          console.log('station possision updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station possision:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }


      }else{
        if (poss == "middle" && type == "normal"){
          const fromstation = await db('se_project.routes').select().where('toStationid', stationid).first();
          const tostation = await db('se_project.routes').select().where('fromStationid', stationid).first();

          const routesbody1 = {routename : "new", fromStationid : fromstation, toStationid: tostation};
          const routesbody2 = {routename : "new", fromStationid : tostation, toStationid: fromstation};
          await db('se_project.routes').insert(routesbody1).then(async () => {
            console.log('route 1 inserted successfully.');
          })
            .catch(async (error) => {
              console.error('Error inserting route 1:', error);
              await db.destroy();
              return res.status(400).send("Something went wrong! Please try again later.")
            });
          

          await db('se_project.routes').insert(routesbody2).then(async () => {
            console.log('route 2 inserted successfully.');
          })
            .catch(async (error) => {
              console.error('Error inserting route 2:', error);
              await db.destroy();
              return res.status(400).send("Something went wrong! Please try again later.")
            });

        }else{
          if (poss == "middle" && type == "transfer"){
            const tostationids = await db('se_project.routes').select('toStationid').where('fromStationid', stationid);
            const tostationid1 = tostationids[0];
            const tostationid2 = tostationids[1];
            const fromstationid = await db('se_project.routes').select('fromStationid').where('toStationid', stationid);
            const r1 = {fromStationid: fromstationid, toStationid: tostationid1, routename: "new"};
            const r2 = {fromStationid: fromstationid, toStationid: tostationid2, routename: "new"};
            const r3 = {fromStationid: tostationid1, toStationid: fromstationid, routename: "new"};
            const r4 = {fromStationid: tostationid2, toStationid: fromstationid, routename: "new"};
            await db('se_project.routes').insert(r1).then(async () => {
              console.log('route 1 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting route 1:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.routes').insert(r2).then(async () => {
              console.log('route 2 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting route 2:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.routes').insert(r3).then(async () => {
              console.log('route 3 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting route 3:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.routes').insert(r4).then(async () => {
              console.log('route 4 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting route 4:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            const rid1 = await db('se_project.routes').select('id').where('fromStationid', fromstationid).where('toStationid', tostationid1);
            const rid2 = await db('se_project.routes').select('id').where('fromStationid', fromstationid).where('toStationid', tostationid2);
            const rid3 = await db('se_project.routes').select('id').where('fromStationid', tostationid1).where('toStationid', fromstationid);
            const rid4 = await db('se_project.routes').select('id').where('fromStationid', tostationid2).where('toStationid', fromstationid);

            const sr1 = {routeid: rid1, stationid: fromstationid};
            const sr2 = {routeid: rid1, stationid: tostationid1};
            const sr3 = {routeid: rid2, stationid: fromstationid};
            const sr4 = {routeid: rid2, stationid: tostationid2};
            const sr5 = {routeid: rid3, stationid: tostationid1};
            const sr6 = {routeid: rid3, stationid: fromstationid};
            const sr7 = {routeid: rid4, stationid: tostationid2};
            const sr8 = {routeid: rid4, stationid: fromstationid};
            await db('se_project.stationRoutes').insert(sr1).then(async () => {
              console.log('sr1 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr1:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.stationRoutes').insert(sr2).then(async () => {
              console.log('sr2 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr2:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.stationRoutes').insert(sr3).then(async () => {
              console.log('sr3 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr3:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.stationRoutes').insert(sr4).then(async () => {
              console.log('sr4 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr4:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

            await db('se_project.stationRoutes').insert(sr5).then(async () => {
              console.log('sr5 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr5:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });
  
            await db('se_project.stationRoutes').insert(sr6).then(async () => {
              console.log('sr6 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr6:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });
  
            await db('se_project.stationRoutes').insert(sr7).then(async () => {
              console.log('sr7 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr7:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });
  
            await db('se_project.stationRoutes').insert(sr8).then(async () => {
              console.log('sr8 inserted successfully.');
            })
              .catch(async (error) => {
                console.error('Error inserting sr8:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.")
              });

              try {
                await db('se_project.stations').where('id', fromstationid).update({ stationtype: "transfer" });
                console.log('station possision updated successfully.');
                await db.destroy();
              } catch (error) {
                console.error('Error updating station possision:', error);
                await db.destroy();
                return res.status(400).send("Something went wrong! Please try again later.");
              }
          }
        }
      }
    }
    try{
      await db('se_project.stations').where('id', stationid).delete();
      console.log('station deleted successfully.');
      await db.destroy();
    } catch (error) {
      console.error('Error deleting station: ', error);
      await db.destroy();
      return res.status(400).send("Something went wrong! Please try again later.");
    }

  })


  app.post('/api/v1/route', async function(req, res){
    const user = await getUser(req)
    if (!user) {
      return res.status(400).send("User not found")
    }
    if (!user.admin) {
      return res.status(400).send("you are not an admin")
    }

    let newStationId , connectedStationId, routeName = req.body;

    const poss = await db('se_project.stations').select('stationposition').where('id', connectedStationId).first();
    const route1 = {fromStationid: newStationId, toStationid: connectedStationId, routename: routeName};
    const route2 = {fromStationid: connectedStationId, toStationid: newStationId, routename: routeName};

    await db('se_project.routes').insert(route1).then(async () => {
      console.log('route 1 inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting route 1:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });

    await db('se_project.routes').insert(route2).then(async () => {
      console.log('route 2 inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting route 2:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });

    const rid1 = await db('se_project.routes').select('id').where('fromStationid', newStationId).where('toStationid', connectedStationId);
    const rid2 = await db('se_project.routes').select('id').where('fromStationid', connectedStationId).where('toStationid', newStationId);

    const sr1 = {routeid: rid1, stationid: newStationId};
    const sr2 = {routeid: rid1, stationid: connectedStationId};
    const sr3 = {routeid: rid2, stationid: newStationId};
    const sr4 = {routeid: rid2, stationid: connectedStationId};

    await db('se_project.stationRoutes').insert(sr1).then(async () => {
      console.log('sr1 inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting sr1:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });

    await db('se_project.stationRoutes').insert(sr2).then(async () => {
      console.log('sr2 inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting sr2:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });
    
    await db('se_project.stationRoutes').insert(sr3).then(async () => {
      console.log('sr3 inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting sr3:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });
  
    await db('se_project.stationRoutes').insert(sr4).then(async () => {
      console.log('sr4 inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting sr4:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });

    if(poss == "end"){
      try {
        await db('se_project.stations').where('id', connectedStationId).update({ stationposition: "middle" });
        console.log('connected station possision updated successfully.');
        await db.destroy();
      } catch (error) {
        console.error('Error updating connected station possision:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.");
      }

      try {
        await db('se_project.stations').where('id', newStationId).update({ stationposition: "end" });
        console.log('new station possision updated successfully.');
        await db.destroy();
      } catch (error) {
        console.error('Error updating new station possision:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.");
      }
    }else{
      if(poss == "start"){
        try {
          await db('se_project.stations').where('id', connectedStationId).update({ stationposition: "middle" });
          console.log('connected station possision updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating connected station possision:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }
  
        try {
          await db('se_project.stations').where('id', newStationId).update({ stationposition: "start" });
          console.log('new station possision updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating new station possision:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }
      }
    }
  })
  app.get("/api/v1/zones", async (req, res) => {
    console.log(req)
    try {
      const zones = await db('se_project.zones').select('*');
      console.log("zones", zones)
      await db.destroy();
      return res.status(200).json(zones)
    } catch (error) {
      console.error('Error updating password:', error);
      await db.destroy();
      return res.status(400).send("Something went wrong! Please try again later.");
    }
  });




  app.get('/api/v1/tickets/price/:originId/:destinationId', async (req, res) => {
    const originId = req.params.originId;
    const destinationId = req.params.destinationId;

    try {
      // Retrieve the price of the ticket based on the origin and destination
      const ticketPrice = await calculateTicketPrice(originId, destinationId);

      if (ticketPrice === null) {
        return res.status(404).json({ error: 'Ticket price not found' });
      }

      // Return the ticket price in the response
      res.json({ price: ticketPrice });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'An error occurred while retrieving the ticket price' });
    }
  });





  app.post('/api/v1/tickets/purchase/subscription', async (req, res) => {
    const user = await getUser(req);
    console.log("farahhhh" + user.roleid);
    //check that the user exists
    if (!user) {
      return res.status(400).send("User not found")
    }
    try {

      const subid = req.body.subId;
      // Check if the user has an active subscription
      const subscription = await db('se_project.subsription').where('id', subid);
      if (!subscription) {
        return res.status(404).json({ error: 'User subscription not found' });
      }
      

      // Create a new ticket based on the user's subscription
      const ticket = {
        origin: req.body.origin,
        destination: req.body.destination,
        userid: user.userid,
        subid: req.body.subId,
        tripdate: req.body.tripdate
      };

      // Insert the new ticket into the database
      const ticketId = await db('se_project.tickets').insert(ticket).returning('*');

      // Retrieve additional ticket details (price, route, transfer stations)
      const additionalDetails = await db.select('se_project.routes.routename', 'se_project.stations.stationname').from('se_project.routes')
        .innerJoin('se_project.stations', 'se_project.routes.fromstationid', '=', 'se_project.stations.id')
        .where('se_project.routes.fromstationid', req.body.origin)
        .where('se_project.routes.tostationid', req.body.destination);

      // Construct the response
      const response = {
        // ticketId: ticketId[0],
        // origin: ticket.origin,
        // destination: ticket.destination,
        // tripdate: ticket.tripdate,
        // route: additionalDetails[0].routename,
        // transferStations: additionalDetails.map(detail => detail.stationname)
      };
      // Return the response
      res.status(200).json('Purchase Tmam')
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'An error occurred while purchasing the ticket' });
    }
  });
  app.post('/api/v1/zones/:zoneId', async function (req, res) {
    try {
      await db('statise_project.zones').where('price', price).update({ price: price });
      console.log('Zone price updated successfully!');
    } catch (error) {
      console.error('Error updating zone price:', error);
    } finally {
      // Close the database connection
      db.destroy();
    }
  });
  app.delete('/api/v1/route/:routeId', async function(req, res){
    const user = await getUser(req)
    if (!user) {
      return res.status(400).send("User not found")
    }
    if (!user.admin) {
      return res.status(400).send("you are not an admin")
    }

    let routeid = req.params.routeId;
    const to = await db('se_project.routes').select('toStationid').where('id', routeid);
    const from = await db('se_project.routes').select('fromStationid').where('id', routeid);
    const opposite = await db('se_project.routes').select('*').where('toStationid', from).where('fromStationid', to);
    if(opposite != null){
      try{
        await db('se_project.routes').where('id', routeid).delete();
        console.log('route deleted successfully.');
        await db.destroy();
      } catch (error) {
        console.error('Error deleting route: ', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.");
      }
    }else{
      const poss1 = await db('se_project.stations').select('stationposition').where('id', to);
      const poss2 = await db('se_project.stations').select('stationposition').where('id', from);
      if(poss1 == "end"){
        try {
          await db('se_project.stations').where('id', from).update({ stationposition: "end" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', to).update({ stationstatus: "new" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', to).update({ stationposition: null });
          console.log('station updated successfully.');
          await db.destroy();
          return res.status(200).send("station updated successfully.");
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }
      }

      if(poss1 == "start"){
        try {
          await db('se_project.stations').where('id', from).update({ stationposition: "start" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', to).update({ stationstatus: "new" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', to).update({ stationposition: null });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }
      }

      if(poss2 == "end"){
        try {
          await db('se_project.stations').where('id', to).update({ stationposition: "end" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', from).update({ stationstatus: "new" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', from).update({ stationposition: null });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }
      }

      if(poss2 == "start"){
        try {
          await db('se_project.stations').where('id', to).update({ stationposition: "start" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', from).update({ stationstatus: "new" });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }

        try {
          await db('se_project.stations').where('id', from).update({ stationposition: null });
          console.log('station updated successfully.');
          await db.destroy();
        } catch (error) {
          console.error('Error updating station:', error);
          await db.destroy();
          return res.status(400).send("Something went wrong! Please try again later.");
        }
      }

      try{
        await db('se_project.routes').where('id', routeid).delete();
        console.log('route deleted successfully.');
        await db.destroy();
        return res.status(200).send("route deleted successfully.");
      } catch (error) {
        console.error('Error deleting route: ', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.");
      }
    }
  })




  app.post("/api/v1/payment/subscription", async (req, res) => {
    const user = await getUser(req);
    //check that the user exists
    if (!user) {
      return res.status(400).send("User not found")
    }
    let {  creditCardNumber, holderName, payedAmount, subType, zoneId } = req.body;
    //check zone exists
    await db('se_project.zones').select().where('id', zoneId).then(async (rows) => {
      if (rows.length > 0) {
        console.log('Row exists in the "zones" table.');
      } else {
        console.log('Row does not exist in the "zones" table.');
        return res.status(403).send("Row does not exist in the \"zones\" table.");
      }
    })
      .catch(async (error) => {
        console.error('Error checking row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later2.");
      });
    //add user id to request and calculate number of tickets
    const numberOfTickets = req.body.subType === "monthly" ? 10 : (req.body.subType === "quarterly" ? 50 : 100)
    const subscriptionBody = { userid: user.userid, subtype: subType, zoneid: zoneId, nooftickets: numberOfTickets }
    // insert into subscriptions table
    await db('se_project.subsription').insert(subscriptionBody).then(async () => {
      console.log('Row inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.1")
      });
    
    const paymentID = await db('se_project.subsription').select('id').where('userid', user.userid).where('subtype', subType)
    .where('zoneid', zoneId).where('nooftickets', numberOfTickets).first()
    const transactionBody = { amount: payedAmount, userid: user.userid , purchasedid: paymentID} 
    //insert into transactions table
    await db('se_project.transactions').insert(transactionBody).then(async () => {
      console.log('Row inserted successfully.');
      await db.destroy();
      return res.status(200).send("Successful Operation ")
    })
      .catch(async (error) => {
        console.error('Error inserting row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });
  })




//admin request
  app.post('/api/v1/requests/senior/:requestId', async (req, res) => {
    console.log("reeeee");
    const { nationalId } = req.body;
      //uses session id to get the user
      const user = await getUser(req);
      //check that the user exists
      if (!user) {
        return res.status(400).send("User not found")
      }
      // Check if there is an existing senior request for the user
      const existingRequest = await db('se_project.senior_requests').where('userid', user.id).first();
      if (existingRequest) {
        return res.status(400).json({ error: 'Senior request already exists for this user' });
      }
      else{
        await db('se_project.senior_requests').where('userid',user.id).update('status', "accepted");
      }
    });

      // Create a new senior request
      app.post("/api/v1/senior/request", async function(req, res) {
        console.log("hiiiu");
        const { nationalId } = req.body;
        const requestId = await db("se_project.senior_requests")
          .insert(newRequest)
          .returning("*");
        console.log(requestId);
        const user = getUser(req);
        console.log(user.userid);
      
        if (!user) {
          res.status(400).json({ message: "User not found" });
          return;
        }
      
        const newRequest = {
          status: "pending",
          userid: user.id,
          nationalid: nationalId
        };
        console.log(newRequest);
      
        
      
        res.status(200).send("Senior request is added");
      });
      
      
      

  app.put('/api/v1/ride/simulate', async (req, res) => {
    const { origin, destination, tripdate } = req.body;

    try {
      // Check if the stations exist
      const stations = await db('se_project.stations').select('id').whereIn('stationname', [origin, destination]).limit(2);

      if (stations.length !== 2) {
        return res.status(404).json({ error: 'One or both of the stations not found' });
      }

      const originStationId = stations.find(station => station.stationname === origin).id;
      const destinationStationId = stations.find(station => station.stationname === destination).id;

      // Check if there is an existing ride for the same origin, destination, and trip date
      const existingRide = await db('se_project.rides').where('origin', originStationId).andWhere('destination', destinationStationId)
        .andWhere('tripdate', tripdate).first();

      if (existingRide) {
        return res.status(400).json({ error: 'Ride already exists for the same origin, destination, and trip date' });
      }

      // Create a new ride
      const newRide = {
        status: 'completed',
        origin: originStationId,
        destination: destinationStationId,
        tripdate: tripdate
      };

      const rideId = await db('se_project.rides').insert(newRide);

      res.status(201).json({ id: rideId[0], message: 'Ride simulated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while simulating the ride' });
    }
  });
  



  app.post("/api/v1/payment/ticket", async (req, res) => {
    const user = await getUser(req);
    //check that the user exists
    if (!user) {
      return res.status(400).send("User not found")
    }
    let {  creditCardNumber, holderName, payedAmount, origin, destination, tripdate } = req.body;

    // await db('se_project.subsription').select('id').where('userid', user.userid).then(async (rows) => {
    //   if (rows.length > 0) {
    //     console.log('Row exists in the "subsription" table.');
    //     const subid = rows[0]
    //   } else {
    //     console.log('Row does not exist in the "subsription" table.');
    //     return res.status(403).send("Row does not exist in the \"subsription\" table.");
    //   }
    // })
    //   .catch(async (error) => {
    //     console.error('Error checking row:', error);
    //     await db.destroy();
    //     return res.status(400).send("Something went wrong! Please try again later2.");
    //   });

    const ticketdoby = { origin: origin, destination: destination, userid: user.userid, tripdate: tripdate }
    
    // insert into ticket table
    await db('se_project.tickets').insert(ticketdoby).then(async () => {
      console.log('Row inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later 1.")
      });
    //insert into transactions table
    let purchasedid = await db('se_project.tickets').select('id').where('userid', user.userid).where('origin', origin)
    .where('destination',destination).where('tripdate',tripdate).first()

    //console.log (purchasedid[0].id);
    purchasedid=purchasedid.id
    const transactionBody = { purchasedid: purchasedid, amount: payedAmount, userid: user.userid }

    await db('se_project.transactions').insert(transactionBody).then(async () => {
      console.log('Row inserted successfully.');
      // await db.destroy();
      return res.status(200).send("Successful Operation 1")
    })
      .catch(async (error) => {
        console.error('Error inserting row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.2")
      });

    const ridebody = {status: "upcoming", origin: origin, destination: destination, userid: user.userid, ticketid: purchasedid, tripdate: tripdate}
    await db('se_project.rides').insert(ridebody).then(async () => {
      console.log('Row inserted successfully.');
      await db.destroy();
      return res.status(200).send("Successful Operation 2")
    })
      .catch(async (error) => {
        console.error('Error inserting row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.3")
      });
  })






  // app.put("/api/v1/refund/:ticketId", async function (req, res) {
  //   const ticketID = req.param['ticketId']
  //   try {

  //   }
  //   catch (error) {

  //   }
  // })




  app.post("/api/v1/station", async function (req, res) {
    const user = await getUser(req)
    if (!user) {
      return res.status(400).send("User not found")
    }
    if (!user.admin) {
      return res.status(400).send("you are not an admin")
    }

    const name = req.body
    const stationbody = { stationname: name }
    await db('se_project.stations').insert(stationbody).then(async () => {
      console.log('Station inserted successfully.');
    })
      .catch(async (error) => {
        console.error('Error inserting Station:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.")
      });
  })





  app.post("/api/v1/station/:stationId", async function (req, res) {
    const user = await getUser(req)
    if (!user) {
      return res.status(400).send("User not found")
    }
    if (!user.admin) {
      return res.status(400).send("you are not an admin")
    }

    const stationID = req.param['stationId']
    const name = req.body.stationname

    try {
      await db('statise_project.stationsons').where('id', stationID).update({ stationname: name });
      console.log('Station name updated successfully!');
    } catch (error) {
      console.error('Error updating station name:', error);
    } finally {
      // Close the database connection
      db.destroy();
    }
  })

  app.put("/api/v1/route/:routeId", async function(req, res){
    const user = await getUser(req)
    if (!user){
      return res.status(400).send("User not found")
    }

    if (!user.admin){
      return res.status(400).send("you are not an admin")
    }

    const name = req.body.routeName
    const routeID = req.param['routeId']

    try {
      await db('statise_project.routes').where('id', routeID).update({ routename: name });
      console.log('Route name updated successfully!');
    } catch (error) {
      console.error('Error updating route name:', error);
    } finally {
      // Close the database connection
      db.destroy();
    }
    
  })



  app.post('/api/v1/refund/:ticketId', async function (req, res) {
    const user = await getUser(req)
    if (!user) {
      return res.status(400).send("User not found")
    }
    const ticketid = req.param['ticketId']

    await db('se_project.tickets').select().where('id', ticketid).then(async (rows) => {
      if (rows[0].tripdate > 0) {
        const ticketbody = { ticketid: ticketid, status: "pending", userid: user.userid, }
      } else {
        console.log('Ticket does not exist in the "tickets" table.');
        return res.status(403).send("Ticket does not exist in the \"tickets\" table.");
      }
    })
      .catch(async (error) => {
        console.error('Error checking row:', error);
        await db.destroy();
        return res.status(400).send("Something went wrong! Please try again later.");
      });
   
  })
};
