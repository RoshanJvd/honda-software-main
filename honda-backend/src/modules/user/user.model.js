import { Schema, model } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin','agent','inventory','service'], default: 'agent' },
  // optional list of item/service ids assigned to this user
  assignedItems: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
  assignedServices: [{ type: Schema.Types.ObjectId, ref: 'Service' }]
}, { timestamps: true });

export const User = model('User', UserSchema);
