const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userid', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleid', 'se_project.roles.id')
    .first();
  
  console.log('user =>', user)
//   user.isAdmin = user.roleid === roles.admin;
//   user.isSenior = user.roleid === roles.senior;
//   return user;  
}

module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select('*').from('se_project.users');
    return res.render('users', { users });
  });

  // Register HTTP endpoint to render /courses page
  app.get('/stations', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('stations_example', { ...user, stations });
  });
 app.get('/resetpassword', async function(req, res){
  const user = await getUser(req);
    return res.render('resetpassword', user);
  });
  app.get('/subscriptions', async function(req, res){
    const user = await getUser(req);
    const subscription = await db.select('*').from('se_project.subscription');
    return res.render('subscription', {subscription});
  });
  app.get('/rides/simulate', async function(req, res){
    const user = await getUser(req);
    const rides = await db.select('*').from('se_project.rides');
    return res.render('rides', rides);
  });
  app.get('/tickets/price/:originId/:destinationId', async function(req,res){
    const user = await getUser(req);
    const tickets = await db.select('*').from('se_project.tickets');
    return res.render('checkprice',tickets);
  })
  app.get('/api/v1/payment/ticket', async function(req,res){
    const user = await getUser(req);
    const tickets = await db.select('*').from('se_project.tickets');
    return res.render('tickets',tickets);
  })
  app.get('/api/v1/requests/refunds', async function(req,res){
    const user = await getUser(req);
    const tickets = await db.select('*').from('se_project.tickets');
    return res.render('refundrequest',tickets);
  })
  app.get('/api/v1/senior/request', async function(req,res){
    const user = await getUser(req);
    const tickets = await db.select('*').from('se_project.tickets');
    return res.render('seniorrefundrequest',tickets);
  })
  app.get('/api/v1/station', async function(req,res){
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('mangestations',stations);
  })
  app.get('/station', async function(req,res){
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('mangestations',stations);
  })
  // app.get('/stations', async function(req,res){
  //   const user = await getUser(req);
  //   const routes = await db.select('*').from('se_project.routes');
  //   return res.render('mangeroutes',routes);
  // })
  app.get('/api/v1/requests/refunds', async function(req,res){
    const user = await getUser(req);
    const routes = await db.select('*').from('se_project.routes');
    return res.render('mangeroutes',routes);
  })
  app.get('/api/v1/zones', async function(req,res){
    const user = await getUser(req);
    const zones = await db.select('*').from('se_project.routes');
    return res.render('zones',zones);
  })
};