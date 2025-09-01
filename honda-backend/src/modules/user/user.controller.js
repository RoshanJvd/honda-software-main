import { User } from './user.model.js';
import { Item } from '../item/item.model.js';
import { Service } from '../service/service.model.js';

export async function list(req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ data: users });
}

export async function create(req, res) {
  // only admin should reach here via requireRole(['admin'])
  const { name, role, password } = req.body;

  if (!name || !role || !password) {
    return res.status(400).json({
      message: 'Name, role, and password are required'
    });
  }

  try {
    const saved = await User.create({ name, role, password });
    // Return user data without password
    const userResponse = {
      _id: saved._id,
      name: saved.name,
      role: saved.role,
      assignedItems: saved.assignedItems,
      assignedServices: saved.assignedServices,
      createdAt: saved.createdAt
    };
    res.status(201).json(userResponse);
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
}

export async function update(req, res) {
  const doc = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json(doc);
}

export async function remove(req, res) {
  await User.findByIdAndDelete(req.params.id);
  res.status(204).end();
}

// Assign items to a user
export async function assignItems(req, res) {
  const { userId } = req.params;
  const { itemIds } = req.body;
  
  try {
    // Update user's assigned items
    const user = await User.findByIdAndUpdate(
      userId,
      { assignedItems: itemIds },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Update items to be assigned to this user
    await Item.updateMany(
      { _id: { $in: itemIds } },
      { assignedTo: userId }
    );
    
    // Remove assignment from items not in the list
    await Item.updateMany(
      { assignedTo: userId, _id: { $nin: itemIds } },
      { $unset: { assignedTo: 1 } }
    );
    
    res.json({ message: 'Items assigned successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign items', error: error.message });
  }
}

// Assign services to a user
export async function assignServices(req, res) {
  const { userId } = req.params;
  const { serviceIds } = req.body;
  
  try {
    // Update user's assigned services
    const user = await User.findByIdAndUpdate(
      userId,
      { assignedServices: serviceIds },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Update services to be assigned to this user
    await Service.updateMany(
      { _id: { $in: serviceIds } },
      { assignedTo: userId }
    );
    
    // Remove assignment from services not in the list
    await Service.updateMany(
      { assignedTo: userId, _id: { $nin: serviceIds } },
      { $unset: { assignedTo: 1 } }
    );
    
    res.json({ message: 'Services assigned successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to assign services', error: error.message });
  }
}

// Get user assignments
export async function getAssignments(req, res) {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId)
      .populate('assignedItems')
      .populate('assignedServices');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      user: user.name,
      role: user.role,
      assignedItems: user.assignedItems || [],
      assignedServices: user.assignedServices || []
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get assignments', error: error.message });
  }
}

// Authenticate user for login
export async function authenticate(req, res) {
  const { name, role, password } = req.body;

  if (!name || !role || !password) {
    return res.status(400).json({ message: 'Name, role, and password are required' });
  }

  try {
    // Find user by name and role
    const user = await User.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive exact match
      role: role
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check password (plain text for demo - in production use bcrypt)
    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Return user data (without sensitive information)
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
}
