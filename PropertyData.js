const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Property = require('./src/models/Property');

const seedAssetsPath = path.join(__dirname, 'seed-assets');
const uploadsPath = path.join(__dirname, 'uploads');

const propertyData = [
  {
    name: 'Dvilla Residences Batu',
    photo: 'prop1.png',
    size: '1400ft',
    type: 'Residences',
    status: 'Rent',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8566, 2.3522],
    ownerId: 101,
    ownerName: 'Jane Cooper',
    rating: 4.5
  },
  {
    name: 'Luxury Villa',
    photo: 'prop2.png',
    size: '1400ft',
    type: 'Villas',
    status: 'Rent',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8584, 2.2945],
    ownerId: 101,
    ownerName: 'Jane Cooper',
    rating: 4.3
  },
  {
    name: 'PK House',
    photo: 'prop3.png',
    size: '1400ft',
    type: 'Bungalow',
    status: 'Sold',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8606, 2.3376],
    ownerId: 102,
    ownerName: 'Wade Warren',
    rating: 4.1
  },
  {
    name: 'Tungis Luxury',
    photo: 'prop4.png',
    size: '1400ft',
    type: 'Apartment',
    status: 'Sale',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8462, 2.3400],
    ownerId: 102,
    ownerName: 'Wade Warren',
    rating: 4.2
  },
  {
    name: 'Weekend Villa MBH',
    photo: 'prop5.png',
    size: '1400ft',
    type: 'Villas',
    status: 'Rent',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8738, 2.2950],
    ownerId: 103,
    ownerName: 'Emily Carter',
    rating: 4.7
  },
  {
    name: 'Luxury Penthouse',
    photo: 'prop6.png',
    size: '1400ft',
    type: 'Guest house',
    status: 'Sale',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8530, 2.3499],
    ownerId: 103,
    ownerName: 'Emily Carter',
    rating: 4.6
  },
  {
    name: 'Ojag Duplex Apartment',
    photo: 'prop7.png',
    size: '1400ft',
    type: 'Apartment',
    status: 'Sold',
    bedrooms: 5,
    country: 'France',
    city: 'Paris',
    price: '8930.00',
    address: '4604, PH8 Lane Kiiowa',
    bath: 4,
    floor: 2,
    coordinates: [48.8698, 2.3340],
    ownerId: 104,
    ownerName: 'Liam Johnson',
    rating: 4.4
  },
];

mongoose.connect('mongodb://192.168.0.152:27017/urbanUsers', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const copyImageToUploads = (fileName) => {
  const sourcePath = path.join(seedAssetsPath, fileName);
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(fileName)}`;
  const destPath = path.join(uploadsPath, uniqueName);

  fs.copyFileSync(sourcePath, destPath);
  return `/uploads/${uniqueName}`;
};

const insertProperties = async () => {
  try {
    for (const prop of propertyData) {
      const newPhotoPath = copyImageToUploads(prop.photo);

      const update = {
        ...prop,
        photo: newPhotoPath,
        createdAt: new Date(),
      };

      // Remove nested `owner` if it exists (just in case)
      delete update.owner;

      await Property.findOneAndUpdate(
        { name: prop.name }, // match by name
        update,
        { upsert: true, new: true }
      );
    }

    console.log('✔ Properties seeded or updated.');
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding properties:', err);
    process.exit(1);
  }
};

insertProperties();
