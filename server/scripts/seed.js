import { user as user_default, m_role as Role, m_menu as Menu, role_menu as RoleMenu } from '../models/index.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

// Sample data
const roles = [
  {
    name: 'Super Admin',
    status: true
  },
  {
    name: 'Staff',
    status: true
  }
];

const menus = [
  {
    name: 'Dashboard',
    modul: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard',
    seq: 1,
    status: true
  },
  {
    name: 'user_default Management',
    modul: 'Settings',
    path: '/users',
    icon: 'people',
    seq: 2,
    status: true
  },
  {
    name: 'Role Management',
    modul: 'Settings',
    path: '/roles',
    icon: 'security',
    seq: 3,
    status: true
  },
  {
    name: 'Menu Management',
    modul: 'Settings',
    path: '/menus',
    icon: 'menu',
    seq: 4,
    status: true
  }
];

const users = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'password123',
    role: 'Super Admin'
  },
  {
    username: 'staff',
    email: 'staff@example.com',
    password: 'password123',
    role: 'Staff'
  }
];


// Seed database
async function seed() {
  try {
    // console.log('Starting database seeding...');

    // Create roles
    // console.log('Creating roles...');
    const createdRoles = {};
    for (const roleData of roles) {
      const role = await Role.create(roleData);
      createdRoles[roleData.name] = role;
    }
    // console.log(`Created ${Object.keys(createdRoles).length} roles`);

    // Create menus
    // console.log('Creating menus...');
    const createdMenus = [];
    for (const menuData of menus) {
      const menu = await Menu.create(menuData);
      createdMenus.push(menu);
    }
    // console.log(`Created ${createdMenus.length} menus`);

    // Create role-menu relationships
    // console.log('Creating role-menu relationships...');
    // Super Admin gets all permissions for all menus
    for (const menu of createdMenus) {
      await RoleMenu.create({
        role_id: createdRoles['Super Admin'].id,
        menu_id: menu.id,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true
      });
    }

    // Staff gets view-only permissions for Dashboard
    const dashboardMenu = createdMenus.find(m => m.name === 'Dashboard');
    if (dashboardMenu) {
      await RoleMenu.create({
        role_id: createdRoles['Staff'].id,
        menu_id: dashboardMenu.id,
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false
      });
    }

    // Create users
    // console.log('Creating users...');
    const createdUsers = [];
    for (const userData of users) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      const role = createdRoles[userData.role];

      const user = await user_default.create({
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role_id: role.id,
        isActive: true
      });

      createdUsers.push(user);
    }
    // console.log(`Created ${createdUsers.length} users`);

    // console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

seed();