const crypto = require("crypto");
const pool = require("../db/database");

const COOKIE_NAME = "gm_session";
function hashToken(token){ return crypto.createHash("sha256").update(token).digest("hex"); }
async function createSession(res, user){
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await pool.query("DELETE FROM sessions WHERE user_id=$1 OR expires_at < NOW()", [user.id]);
  await pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,NOW() + INTERVAL '30 days')", [user.id, tokenHash]);
  res.cookie(COOKIE_NAME, token, {httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:30*24*60*60*1000,path:"/"});
}
async function clearSession(req,res){
  const token=req.cookies && req.cookies[COOKIE_NAME];
  if(token){ try{ await pool.query("DELETE FROM sessions WHERE token_hash=$1",[hashToken(token)]); }catch(e){} }
  res.clearCookie(COOKIE_NAME,{path:"/"});
}
async function attachUser(req,res,next){
  const token=req.cookies && req.cookies[COOKIE_NAME];
  if(!token) return next();
  try{
    const result=await pool.query(`SELECT u.id,u.name,u.email,u.phone,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1`,[hashToken(token)]);
    if(result.rows[0]) req.user=result.rows[0];
  }catch(e){ return next(e); }
  next();
}
function requireAuth(req,res,next){ if(!req.user) return res.status(401).json({error:"Login required"}); next(); }
function requireAdmin(req,res,next){ if(!req.user || req.user.role!=="admin") return res.status(403).json({error:"Admin access required"}); next(); }
module.exports={COOKIE_NAME,createSession,clearSession,attachUser,requireAuth,requireAdmin};
