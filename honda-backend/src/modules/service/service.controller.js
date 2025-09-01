import { Service } from './service.model.js';
export async function list(req,res){ const {q='',limit=100,skip=0}=req.query;
  let where = q?{name:new RegExp(q,'i')}:{};
  if (req.userRole === 'agent') where = { ...where, assignedTo: req.userId };
  const [data,total]=await Promise.all([
    Service.find(where).sort({createdAt:-1}).skip(+skip).limit(Math.min(200,+limit)),
    Service.countDocuments(where)
  ]);
  res.json({data,total});
}
export async function create(req,res){ const saved=await Service.create(req.body); res.status(201).json(saved); }
export async function update(req,res){ const doc=await Service.findByIdAndUpdate(req.params.id,req.body,{new:true});
  if(!doc) return res.status(404).json({message:'Not found'}); res.json(doc);
}
export async function remove(req,res){ await Service.findByIdAndDelete(req.params.id); res.status(204).end(); }

export async function scan(req,res){ const {code}=req.params; if(!code) return res.status(400).json({message:'code required'});
  let where = { $or: [{ name: code }, { barcode: code }] };
  if (req.userRole === 'agent') where.assignedTo = req.userId;
  const s = await Service.findOne(where);
  if(!s) return res.status(404).json({message:'Not found'});
  res.json(s);
}
