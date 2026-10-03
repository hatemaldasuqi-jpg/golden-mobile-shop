const express = require("express");
const pool = require("../db/database");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

function clean(v){ return v == null ? "" : String(v).trim(); }
router.get("/", async (req,res,next)=>{
  try { const r=await pool.query("SELECT * FROM homepage_banners ORDER BY position ASC, id ASC"); res.json({banners:r.rows}); }
  catch(err){ next(err); }
});
router.put("/:id", requireAdmin, async (req,res,next)=>{
  try{
    const old=await pool.query("SELECT * FROM homepage_banners WHERE id=$1",[req.params.id]);
    if(!old.rows[0]) return res.status(404).json({error:"Banner not found"});
    const b=old.rows[0], x=req.body||{};
    const r=await pool.query(`UPDATE homepage_banners SET title=$1, subtitle=$2, button_text=$3, button_link=$4, image_url=$5, badge_text=$6, is_active=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,[
      x.title!==undefined?clean(x.title):b.title, x.subtitle!==undefined?clean(x.subtitle):b.subtitle,
      x.button_text!==undefined?clean(x.button_text):b.button_text, x.button_link!==undefined?clean(x.button_link):b.button_link,
      x.image_url!==undefined?clean(x.image_url):b.image_url, x.badge_text!==undefined?clean(x.badge_text):b.badge_text,
      x.is_active!==undefined?Boolean(x.is_active):b.is_active, req.params.id
    ]);
    res.json({banner:r.rows[0]});
  }catch(err){ next(err); }
});
module.exports=router;
