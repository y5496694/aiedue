# aiedue

This project uses Firebase Storage to persist images for the book creator.  If image uploads fail with a CORS error, configure the bucket with the provided rules and CORS file.

## Setup

1. Deploy Firestore and Storage security rules:

```sh
firebase deploy --only storage,firestore
```

2. Apply the CORS policy to the storage bucket:

```sh
gsutil cors set storage-cors.json gs://mansungcoin-c6e06.appspot.com
```

These steps allow authenticated users to upload images from `https://aiedue.netlify.app` without CORS issues.
