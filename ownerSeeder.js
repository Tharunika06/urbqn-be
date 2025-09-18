const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Owner = require('./src/models/Owner');

const seedAssetsPath = path.join(__dirname, 'seed-assets/owners');
const uploadsPath = path.join(__dirname, 'src/uploads/owners');

// Make sure uploads directory exists
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

const ownerData = [
  {
    name: 'Jane Cooper',
    ownerId: '101',
    address: 'Lincoln Drive, Harrisburg, PA 17101, U.S.',
    email: 'jane.hill@example.com',
    contact: '+123 864-357-7710',
    doj: '2021-06-12',
    status: 'Active',
    city: 'Harrisburg',
    photo: 'owner1.jpg',
    // Professional Info
    agency: 'Hill Properties',
    licenseNumber: 'LC-JANE-PA101',
    textNumber: 'TC-JANE-HILL',
    servicesArea: 'Lincoln Drive Harrisburg',
    about: 'Specializing in residential properties and community development in Pennsylvania.',
    // Property Stats
    totalListing: 5,
    propertySold: 12,
    propertyRent: 3,
    // Properties
    properties: [
      {
        name: 'Dvilla Residences Batu',
        photo: '/assets/prop1.png',
        address: '4604, PH8 Lane Kiiowa'
      },
      {
        name: 'Luxury Villa',
        photo: '/assets/prop2.png',
        address: '4604, PH8 Lane Kiiowa'
      }
    ]
  },
  {
    name: 'Wade Warren',
    ownerId: '102',
    address: '2464 Royal Ln, Mesa, New Jersey 45463',
    email: 'wade.h@example.com',
    contact: '(480) 555-0103',
    doj: '2020-08-20',
    status: 'Inactive',
    city: 'Mesa',
    photo: 'owner2.jpg',
    // Professional Info
    agency: 'Metro Homes',
    licenseNumber: 'LC-PRESTIGE-002',
    textNumber: 'TC-WADE-WARREN',
    servicesArea: 'Mesa, Scottsdale',
    about: 'Specializing in urban properties and modern living...',
    // Property Stats
    totalListing: 8,
    propertySold: 25,
    propertyRent: 6,
    // Properties
    properties: [
      {
        name: 'PK House',
        photo: '/assets/prop3.png',
        address: '4604, PH8 Lane Kiiowa'
      },
      {
        name: 'Tungis Luxury',
        photo: '/assets/prop4.png',
        address: '4604, PH8 Lane Kiiowa'
      }
    ]
  },
  {
    name: 'Emily Carter',
    ownerId: '103',
    address: 'Sunset Blvd, Los Angeles, CA 90028',
    email: 'emily.carter@example.com',
    contact: '(213) 123-4567',
    doj: '2019-11-05',
    status: 'Active',
    city: 'Los Angeles',
    photo: 'owner3.jpg',
    // Professional Info
    agency: 'Luxe Homes LA',
    licenseNumber: 'LC-EMILY-CA123',
    textNumber: 'TC-EMILY-LA',
    servicesArea: 'Los Angeles, Beverly Hills',
    about: 'Emily has been managing luxury homes in Los Angeles for over a decade.',
    // Property Stats
    totalListing: 12,
    propertySold: 45,
    propertyRent: 8,
    // Properties
    properties: [
      {
        name: 'Weekend Villa MBH',
        photo: '/assets/prop5.png',
        address: '4604, PH8 Lane Kiiowa'
      },
      {
        name: 'Luxury Penthouse',
        photo: '/assets/prop6.png',
        address: '4604, PH8 Lane Kiiowa'
      }
    ]
  },
  {
    name: 'Liam Johnson',
    ownerId: '104',
    address: '123 King St, Toronto, ON, Canada',
    email: 'liam.j@example.com',
    contact: '(416) 555-9087',
    doj: '2022-03-15',
    status: 'Active',
    city: 'Toronto',
    photo: 'owner4.jpg',
    // Professional Info
    agency: 'Skyline Realty',
    licenseNumber: 'LC-LIAM-TORON',
    textNumber: 'TC-LIAM-CAN',
    servicesArea: 'Toronto, Mississauga',
    about: 'Liam specializes in high-rise condos and waterfront properties in Toronto.',
    // Property Stats
    totalListing: 6,
    propertySold: 18,
    propertyRent: 4,
    // Properties
    properties: [
      {
        name: 'Ojag Duplex Apartment',
        photo: '/assets/prop7.png',
        address: '4604, PH8 Lane Kiiowa'
      }
    ]
  }
];

// Function to copy image and return upload path
const copyImageToUploads = (fileName) => {
  const sourcePath = path.join(seedAssetsPath, fileName);
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(fileName)}`;
  const destPath = path.join(uploadsPath, uniqueName);
  fs.copyFileSync(sourcePath, destPath);
  return `/uploads/owners/${uniqueName}`; // frontend will fetch using this relative path
};

mongoose.connect('mongodb://192.168.0.152:27017/urbanUsers', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const insertOwners = async () => {
  try {
    await Owner.deleteMany();

    const newOwners = ownerData.map((owner) => {
      const photoPath = copyImageToUploads(owner.photo);
      return {
        ...owner,
        photo: photoPath,
        doj: new Date(owner.doj),
        createdAt: new Date()
      };
    });

    await Owner.insertMany(newOwners);
    console.log('✅ Owners seeded with detailed information and photos.');
    process.exit();

  } catch (err) {
    console.error('❌ Error seeding owners:', err);
    process.exit(1);
  }
};

insertOwners();