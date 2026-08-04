require('dotenv').config({ quiet: true });
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({ region: process.env.AWS_REGION });
const bucket = process.env.AWS_S3_BUCKET;
const key = process.argv[2];

client
  .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  .then(() => console.log('EXISTS'))
  .catch((err) => {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log('NOT_FOUND');
    } else {
      console.error('ERROR', err.name, err.message);
      process.exit(1);
    }
  });
