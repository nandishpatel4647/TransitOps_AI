import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Roles Seed
  const roles = [
    { id: 'superadmin', name: 'Super Admin', description: 'Full access to all systems and settings.' },
    { id: 'fleet_manager', name: 'Fleet Manager', description: 'Manages vehicles, drivers, and tracking.' },
    { id: 'dispatcher', name: 'Dispatcher', description: 'Dispatches and manages trips and route scheduling.' },
    { id: 'driver', name: 'Driver', description: 'Assigned to trips and logs mileage and fuel logs.' },
    { id: 'safety_officer', name: 'Safety Officer', description: 'Reviews safety ratings and vehicle incidents.' },
    { id: 'financial_analyst', name: 'Financial Analyst', description: 'Views ROI and manages operational expenses.' },
    { id: 'maintenance_manager', name: 'Maintenance Manager', description: 'Schedules and processes maintenance requests.' },
    { id: 'viewer', name: 'Viewer', description: 'Read-only access across the dashboard.' }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: role
    });
  }
  console.log('Roles seeded.');

  // 2. Demo Users Seed
  const passwordHash = bcrypt.hashSync('demo1234', 10);
  const demoUsers = [
    { email: 'superadmin@transitops.ai', name: 'Alice Admin (Super Admin)', roleId: 'superadmin' },
    { email: 'fleetmanager@transitops.ai', name: 'Bob Fleet (Fleet Manager)', roleId: 'fleet_manager' },
    { email: 'dispatcher@transitops.ai', name: 'Charlie Dispatch (Dispatcher)', roleId: 'dispatcher' },
    { email: 'driver@transitops.ai', name: 'David Driver (Driver)', roleId: 'driver' },
    { email: 'safety@transitops.ai', name: 'Sarah Safety (Safety Officer)', roleId: 'safety_officer' },
    { email: 'finance@transitops.ai', name: 'Frank Finance (Financial Analyst)', roleId: 'financial_analyst' },
    { email: 'maintenance@transitops.ai', name: 'Mike Maintenance (Maintenance Manager)', roleId: 'maintenance_manager' },
    { email: 'viewer@transitops.ai', name: 'Valerie Viewer (Viewer)', roleId: 'viewer' }
  ];

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, roleId: user.roleId },
      create: {
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        passwordHash: passwordHash
      }
    });
  }
  console.log('Users seeded.');

  // Clear existing logs & transactional tables to prevent conflicts on repeated seeds
  await prisma.activityLog.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.fuelLog.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  console.log('Cleared old operational data.');

  // 3. Vehicles Seed
  const vehiclesData = [
    { registrationNumber: 'VAN-05', name: 'Ford Transit 250', type: 'Cargo Van', manufacturer: 'Ford', year: 2021, fuelType: 'Petrol', loadCapacity: 1500, odometer: 42000, acquisitionCost: 35000, status: 'Available', region: 'North' },
    { registrationNumber: 'SEMI-10', name: 'Freightliner Cascadia', type: 'Semi-Truck', manufacturer: 'Freightliner', year: 2019, fuelType: 'Diesel', loadCapacity: 20000, odometer: 185000, acquisitionCost: 120000, status: 'On Trip', region: 'South' },
    { registrationNumber: 'TRK-22', name: 'Hino 268 Flatbed', type: 'Truck', manufacturer: 'Hino', year: 2020, fuelType: 'Diesel', loadCapacity: 8000, odometer: 95000, acquisitionCost: 75000, status: 'In Shop', region: 'East' },
    { registrationNumber: 'VAN-08', name: 'Mercedes Sprinter', type: 'Cargo Van', manufacturer: 'Mercedes-Benz', year: 2022, fuelType: 'Diesel', loadCapacity: 2000, odometer: 15000, acquisitionCost: 48000, status: 'Available', region: 'West' },
    { registrationNumber: 'SEMI-12', name: 'Volvo VNL 860', type: 'Semi-Truck', manufacturer: 'Volvo Trucks', year: 2022, fuelType: 'Diesel', loadCapacity: 22000, odometer: 54000, acquisitionCost: 145000, status: 'On Trip', region: 'North' },
    { registrationNumber: 'TRK-03', name: 'Isuzu NPR Box Truck', type: 'Truck', manufacturer: 'Isuzu', year: 2018, fuelType: 'Diesel', loadCapacity: 6000, odometer: 110000, acquisitionCost: 45000, status: 'Breakdown', region: 'South' },
    { registrationNumber: 'VAN-11', name: 'Chevrolet Express', type: 'Cargo Van', manufacturer: 'Chevrolet', year: 2017, fuelType: 'Petrol', loadCapacity: 1400, odometer: 125000, acquisitionCost: 28000, status: 'Retired', region: 'East' },
    { registrationNumber: 'TRK-15', name: 'Kenworth T370', type: 'Truck', manufacturer: 'Kenworth', year: 2021, fuelType: 'Diesel', loadCapacity: 10000, odometer: 32000, acquisitionCost: 85000, status: 'Reserved', region: 'West' },
    { registrationNumber: 'SEMI-07', name: 'Peterbilt 579', type: 'Semi-Truck', manufacturer: 'Peterbilt', year: 2020, fuelType: 'Diesel', loadCapacity: 21000, odometer: 142000, acquisitionCost: 130000, status: 'Available', region: 'North' },
    { registrationNumber: 'EV-01', name: 'Tesla Semi', type: 'Semi-Truck', manufacturer: 'Tesla', year: 2023, fuelType: 'Electric', loadCapacity: 20000, odometer: 8000, acquisitionCost: 180000, status: 'Available', region: 'West' }
  ];

  const vehicles: any[] = [];
  for (const v of vehiclesData) {
    const created = await prisma.vehicle.create({ data: v });
    vehicles.push(created);
  }
  console.log('Vehicles seeded.');

  // 4. Drivers Seed
  const today = new Date();
  const dateDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };
  const dateDaysAhead = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const driversData = [
    { name: 'Alex Henderson', licenseNumber: 'DL-938210', licenseCategory: 'Class A CDL', licenseExpiryDate: dateDaysAhead(450), contactNumber: '+1 555-0199', emergencyContact: 'Mary Henderson (+1 555-0198)', safetyScore: 94.5, status: 'Available' },
    { name: 'Brian Miller', licenseNumber: 'DL-109283', licenseCategory: 'Class A CDL', licenseExpiryDate: dateDaysAhead(120), contactNumber: '+1 555-0102', emergencyContact: 'Linda Miller (+1 555-0103)', safetyScore: 88.0, status: 'On Trip' },
    { name: 'Chloe Davis', licenseNumber: 'DL-456123', licenseCategory: 'Class B CDL', licenseExpiryDate: dateDaysAgo(5), contactNumber: '+1 555-0145', emergencyContact: 'John Davis (+1 555-0146)', safetyScore: 96.2, status: 'Suspended' }, // License Expired
    { name: 'Daniel Smith', licenseNumber: 'DL-789012', licenseCategory: 'Class A CDL', licenseExpiryDate: dateDaysAhead(15), contactNumber: '+1 555-0156', emergencyContact: 'Susan Smith (+1 555-0157)', safetyScore: 82.1, status: 'Available' }, // License Expiring soon (15 days)
    { name: 'Ethan Hunt', licenseNumber: 'DL-321654', licenseCategory: 'Class A CDL', licenseExpiryDate: dateDaysAhead(720), contactNumber: '+1 555-0188', emergencyContact: 'Julia Hunt (+1 555-0189)', safetyScore: 99.0, status: 'On Trip' },
    { name: 'Fiona Gallagher', licenseNumber: 'DL-654987', licenseCategory: 'Class B CDL', licenseExpiryDate: dateDaysAhead(60), contactNumber: '+1 555-0112', emergencyContact: 'Lip Gallagher (+1 555-0113)', safetyScore: 75.4, status: 'Off Duty' },
    { name: 'George Cooper', licenseNumber: 'DL-258369', licenseCategory: 'Class A CDL', licenseExpiryDate: dateDaysAhead(300), contactNumber: '+1 555-0125', emergencyContact: 'Mary Cooper (+1 555-0126)', safetyScore: 91.0, status: 'Leave' },
    { name: 'Hannah Abbott', licenseNumber: 'DL-147258', licenseCategory: 'Class B CDL', licenseExpiryDate: dateDaysAhead(20), contactNumber: '+1 555-0177', emergencyContact: 'Neville Abbott (+1 555-0178)', safetyScore: 85.8, status: 'Available' } // Expiring soon (20 days)
  ];

  const drivers: any[] = [];
  for (const d of driversData) {
    const created = await prisma.driver.create({ data: d });
    drivers.push(created);
  }
  console.log('Drivers seeded.');

  // Get references
  const vAvailableNorth = vehicles.find(v => v.registrationNumber === 'VAN-05');
  const vOnTripSouth = vehicles.find(v => v.registrationNumber === 'SEMI-10');
  const vInShopEast = vehicles.find(v => v.registrationNumber === 'TRK-22');
  const vAvailableWest = vehicles.find(v => v.registrationNumber === 'VAN-08');
  const vOnTripNorth = vehicles.find(v => v.registrationNumber === 'SEMI-12');

  const dAvailable = drivers.find(d => d.name === 'Alex Henderson');
  const dOnTrip1 = drivers.find(d => d.name === 'Brian Miller');
  const dOnTrip2 = drivers.find(d => d.name === 'Ethan Hunt');

  // 5. Trips Seed (History & Current)
  const tripsData = [
    // Completed Trips (last 7 days)
    { source: 'Chicago Depot', destination: 'Detroit Logistics Center', stops: '["Kalamazoo Hub"]', cargoType: 'Electronics', cargoWeight: 8000, priority: 'High', customer: 'Samsung Logistics', revenue: 2400, status: 'Completed', plannedDistance: 280, actualDistance: 285, fuelConsumed: 32, assignedVehicleId: vOnTripSouth.id, assignedDriverId: dOnTrip1.id, createdAt: dateDaysAgo(6) },
    { source: 'Dallas Warehouse', destination: 'Houston Port', stops: '[]', cargoType: 'Chemicals', cargoWeight: 15000, priority: 'Medium', customer: 'ExxonMobil', revenue: 1800, status: 'Completed', plannedDistance: 240, actualDistance: 242, fuelConsumed: 28, assignedVehicleId: vOnTripSouth.id, assignedDriverId: dOnTrip1.id, createdAt: dateDaysAgo(5) },
    { source: 'Atlanta Hub', destination: 'Charlotte Facility', stops: '[]', cargoType: 'Retail Goods', cargoWeight: 3500, priority: 'Low', customer: 'Walmart Inc.', revenue: 950, status: 'Completed', plannedDistance: 245, actualDistance: 245, fuelConsumed: 18, assignedVehicleId: vAvailableNorth.id, assignedDriverId: dAvailable.id, createdAt: dateDaysAgo(4) },
    { source: 'Los Angeles Depot', destination: 'Phoenix Warehouse', stops: '["Indio Station"]', cargoType: 'Fresh Produce', cargoWeight: 12000, priority: 'High', customer: 'Kroger Co.', revenue: 3100, status: 'Completed', plannedDistance: 370, actualDistance: 375, fuelConsumed: 42, assignedVehicleId: vOnTripNorth.id, assignedDriverId: dOnTrip2.id, createdAt: dateDaysAgo(3) },
    { source: 'Seattle Port', destination: 'Portland Warehouse', stops: '[]', cargoType: 'Paper Products', cargoWeight: 14000, priority: 'Low', customer: 'Weyerhaeuser', revenue: 850, status: 'Completed', plannedDistance: 175, actualDistance: 178, fuelConsumed: 22, assignedVehicleId: vOnTripNorth.id, assignedDriverId: dOnTrip2.id, createdAt: dateDaysAgo(2) },
    { source: 'New York Hub', destination: 'Boston Terminal', stops: '[]', cargoType: 'Apparel', cargoWeight: 4500, priority: 'Medium', customer: 'Target Corp', revenue: 1200, status: 'Completed', plannedDistance: 215, actualDistance: 216, fuelConsumed: 20, assignedVehicleId: vAvailableWest.id, assignedDriverId: dAvailable.id, createdAt: dateDaysAgo(1) },

    // Active/Dispatched Trips
    { source: 'Indianapolis Hub', destination: 'Cleveland Yard', stops: '[]', cargoType: 'Auto Parts', cargoWeight: 11000, priority: 'High', customer: 'General Motors', revenue: 1500, status: 'Dispatched', plannedDistance: 260, assignedVehicleId: vOnTripSouth.id, assignedDriverId: dOnTrip1.id, createdAt: dateDaysAgo(0) },
    { source: 'Salt Lake City Depot', destination: 'Denver Hub', stops: '["Cheyenne Hub"]', cargoType: 'Machinery', cargoWeight: 18000, priority: 'High', customer: 'Caterpillar Inc.', revenue: 4200, status: 'Dispatched', plannedDistance: 520, assignedVehicleId: vOnTripNorth.id, assignedDriverId: dOnTrip2.id, createdAt: dateDaysAgo(0) },

    // Pending/Draft/Cancelled
    { source: 'Memphis Terminal', destination: 'Nashville Station', stops: '[]', cargoType: 'Medical Supplies', cargoWeight: 2500, priority: 'Medium', customer: 'Pfizer', revenue: 900, status: 'Draft', plannedDistance: 210, assignedVehicleId: vAvailableNorth.id, assignedDriverId: dAvailable.id, createdAt: dateDaysAgo(0) },
    { source: 'Miami Warehouse', destination: 'Orlando Hub', stops: '[]', cargoType: 'Beverages', cargoWeight: 9000, priority: 'Low', customer: 'Coca-Cola', revenue: 700, status: 'Cancelled', plannedDistance: 235, assignedVehicleId: vAvailableWest.id, assignedDriverId: dAvailable.id, createdAt: dateDaysAgo(2) }
  ];

  const trips: any[] = [];
  for (const t of tripsData) {
    const created = await prisma.trip.create({ data: t });
    trips.push(created);
  }
  console.log('Trips seeded.');

  // 6. Maintenance Records Seed
  const maintenanceData = [
    { vehicleId: vInShopEast.id, type: 'Breakdown', serviceDate: dateDaysAgo(1), workshop: 'Eastside Heavy Repair', mechanic: 'John Wrench', cost: 1800, parts: 'Engine Alternator, Belt', labour: 400, status: 'In Progress' },
    { vehicleId: vAvailableNorth.id, type: 'Preventive', serviceDate: dateDaysAhead(3), workshop: 'Northside Fleet Care', mechanic: 'Sam Oilchange', cost: 250, parts: 'Engine Oil, Oil Filter, Air Filter', labour: 80, status: 'Scheduled' }, // Upcoming maintenance within 7 days
    { vehicleId: vAvailableWest.id, type: 'Preventive', serviceDate: dateDaysAgo(15), workshop: 'Western Auto Clinic', mechanic: 'Rick Brake', cost: 550, parts: 'Front Brake Pads', labour: 150, status: 'Completed' },
    { vehicleId: vOnTripSouth.id, type: 'Corrective', serviceDate: dateDaysAhead(12), workshop: 'Southside Truck Hub', mechanic: 'Joe Welder', cost: 650, parts: 'Muffler replacement', labour: 200, status: 'Pending' }
  ];

  for (const m of maintenanceData) {
    await prisma.maintenanceRecord.create({ data: m });
  }
  console.log('Maintenance records seeded.');

  // 7. Fuel Logs Seed
  const fuelLogsData = [
    { vehicleId: vOnTripSouth.id, driverId: dOnTrip1.id, date: dateDaysAgo(6), odometer: 184100, fuelQuantity: 32, price: 3.8, totalCost: 121.6 },
    { vehicleId: vOnTripSouth.id, driverId: dOnTrip1.id, date: dateDaysAgo(5), odometer: 184345, fuelQuantity: 28, price: 3.9, totalCost: 109.2 },
    { vehicleId: vAvailableNorth.id, driverId: dAvailable.id, date: dateDaysAgo(4), odometer: 41800, fuelQuantity: 18, price: 3.2, totalCost: 57.6 },
    { vehicleId: vOnTripNorth.id, driverId: dOnTrip2.id, date: dateDaysAgo(3), odometer: 53100, fuelQuantity: 42, price: 3.75, totalCost: 157.5 },
    { vehicleId: vOnTripNorth.id, driverId: dOnTrip2.id, date: dateDaysAgo(2), odometer: 53280, fuelQuantity: 22, price: 3.8, totalCost: 83.6 },
    { vehicleId: vAvailableWest.id, driverId: dAvailable.id, date: dateDaysAgo(1), odometer: 14750, fuelQuantity: 20, price: 3.85, totalCost: 77.0 }
  ];

  for (const f of fuelLogsData) {
    await prisma.fuelLog.create({ data: f });
  }
  console.log('Fuel logs seeded.');

  // 8. General Expenses Seed (in addition to Fuel & Maintenance)
  const expensesData = [
    // Fuel expenses
    { category: 'Fuel', amount: 121.6, date: dateDaysAgo(6), vehicleId: vOnTripSouth.id, driverId: dOnTrip1.id },
    { category: 'Fuel', amount: 109.2, date: dateDaysAgo(5), vehicleId: vOnTripSouth.id, driverId: dOnTrip1.id },
    { category: 'Fuel', amount: 57.6, date: dateDaysAgo(4), vehicleId: vAvailableNorth.id, driverId: dAvailable.id },
    { category: 'Fuel', amount: 157.5, date: dateDaysAgo(3), vehicleId: vOnTripNorth.id, driverId: dOnTrip2.id },
    { category: 'Fuel', amount: 83.6, date: dateDaysAgo(2), vehicleId: vOnTripNorth.id, driverId: dOnTrip2.id },
    { category: 'Fuel', amount: 77.0, date: dateDaysAgo(1), vehicleId: vAvailableWest.id, driverId: dAvailable.id },
    
    // Maintenance expenses
    { category: 'Repair', amount: 550, date: dateDaysAgo(15), vehicleId: vAvailableWest.id },

    // General operational expenses
    { category: 'Toll', amount: 45, date: dateDaysAgo(6), vehicleId: vOnTripSouth.id },
    { category: 'Toll', amount: 35, date: dateDaysAgo(5), vehicleId: vOnTripSouth.id },
    { category: 'Parking', amount: 20, date: dateDaysAgo(4), vehicleId: vAvailableNorth.id },
    { category: 'Toll', amount: 65, date: dateDaysAgo(3), vehicleId: vOnTripNorth.id },
    { category: 'Insurance', amount: 400, date: dateDaysAgo(10), vehicleId: vOnTripNorth.id },
    { category: 'Salary', amount: 1500, date: dateDaysAgo(3), driverId: dOnTrip2.id },
    { category: 'Salary', amount: 1200, date: dateDaysAgo(4), driverId: dOnTrip1.id }
  ];

  for (const e of expensesData) {
    await prisma.expense.create({ data: e });
  }
  console.log('Expenses seeded.');

  // 9. Activity Log seed for dashboard view
  const logsData = [
    { action: 'LOGIN', details: 'superadmin@transitops.ai logged in', timestamp: dateDaysAgo(0) },
    { action: 'CREATE_VEHICLE', details: 'Added new Tesla Semi EV-01 to Western Region', timestamp: dateDaysAgo(1) },
    { action: 'DISPATCH_TRIP', details: 'Dispatched trip from SLC to Denver (assigned SEMI-12 and Ethan Hunt)', timestamp: dateDaysAgo(2) },
    { action: 'COMPLETE_TRIP', details: 'Completed trip Samsung Logistics Chicago -> Detroit (VAN-05 / Alex Henderson)', timestamp: dateDaysAgo(3) },
    { action: 'UPDATE_DRIVER', details: 'Suspended license alert triggered for driver Chloe Davis', timestamp: dateDaysAgo(4) },
    { action: 'CREATE_MAINTENANCE', details: 'Created breakdown maintenance record for TRK-22', timestamp: dateDaysAgo(5) },
    { action: 'LOGIN', details: 'fleetmanager@transitops.ai logged in', timestamp: dateDaysAgo(6) }
  ];

  for (const l of logsData) {
    await prisma.activityLog.create({ data: l });
  }
  console.log('Activity logs seeded.');

  console.log('\n======================================================');
  console.log('DASHBOARD DATA SEEDED SUCCESSFULLY!');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
