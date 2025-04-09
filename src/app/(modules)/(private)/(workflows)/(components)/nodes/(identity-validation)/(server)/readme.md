# 1. Create a client

The first step in creating any check is to create a client from your backend server. A client can be either:

- **Person**: Requires first name and last name
- **Company**: Requires only company name

## Example request for creating a client
```javascript
const { ComplyCube } = require("@complycube/api");

const complycube = new ComplyCube({ apiKey: "<YOUR_API_KEY>" });

const client = await complycube.client.create({
  type: "person",
  email: "john.doe@example.com",
  personDetails: {
    firstName: "John",
    lastName: "Doe"
  }
});
```
### Example response

The response will contain an `id` (the Client ID). This ID is required for the next step.

```json
{
    "id": "5eb04fcd0f3e360008035eb1",
    "type": "person",
    "email": "john.doe@example.com",
    "personDetails": {
        "firstName": "John",
        "lastName": "Doe"
    },
    "createdAt": "2020-01-04T17:24:29.146Z",
    "updatedAt": "2020-01-04T17:24:29.146Z"
}
```

# 2. Create a Live Photo

Upload a live photo by providing:
- Client ID 
- BASE64 encoded selfie image
  - Must be JPG or PNG format
  - Size between 34 KB and 4 MB

## Example Request
The following example shows how to upload a live photo using the Client ID from the previous step.

> Note: You'll need to replace `<BASE64_DATA_CONTENT>` with an actual BASE64 encoded image.

```javascript
const livePhoto = await complycube.livePhoto.upload("5eb04fcd0f3e360008035eb1", {
    data: "<BASE64_DATA_CONTENT>"
});
```

### Example Response

The response will contain an `id` (the Document ID). This ID is required for the next step.

```json
{
    "id": "5eb1b5f231778a0008d1c3f6",
    "clientId": "5eb04fcd0f3e360008035eb1",
    "downloadLink": "/livePhotos/5eb1b5f231778a0008d1c3f6/download",
    "contentType": "images/jpg",
    "size": 44896,
    "createdAt": "2020-01-01T14:06:44.756Z",
    "updatedAt": "2020-01-01T14:06:44.756Z"
}
```

# 3. Create a Document

Create a document by providing:
- Client ID
- Document type (e.g. passport, national ID)

## Example Request
The following example shows how to create a document using the Client ID from the previous step.

```javascript
const document = await complycube.document.create("5eb04fcd0f3e360008035eb1", {
  type: "passport"
});
```

### Example Response

The response will contain an `id` (the Document ID). This ID is required for the next step.

```json
{
    "id": "5ebd40714f23960008c81527",
    "type": "passport",
    "createdAt": "2020-01-04T17:25:21.116Z",
    "updatedAt": "2020-01-04T17:25:21.116Z"
}
```

# 4. Upload Front Side Image of an ID

Upload a BASE64 encoded image of the front-side of the ID document. Depending on the type and country combination, both sides of the ID may be required.

## Requirements
- Image format: JPG or PNG
- File size: Between 34 KB and 4 MB

## Example Request
The following example shows how to upload the front-side image of a document using the Document ID from the previous step.

> Note: You'll need to replace `<BASE64_DATA_CONTENT>` with an actual BASE64 encoded image.

```javascript
const frontImage = await complycube.document.upload("5ebd40714f23960008c81527", {
    fileName: "front-test.jpg",
    data: "<BASE64_DATA_CONTENT>"
}, "front");
```

### Example Response

The response will contain an `id` (the Document Image ID). This ID is required for the next step.

```json
{
    "id": "5eb169302d868c0008828591",
    "fileName": "front-test.jpg",
    "documentSide": "front",
    "downloadLink": "/documents/5ebd40714f23960008c81527/images/5eb169302d868c0008828591/download",
    "contentType": "image/jpg",
    "size": 72716,
    "createdAt": "2020-01-04T17:25:21.116Z",
    "updatedAt": "2020-01-04T17:25:21.116Z"
}
```

# 5. Create a check

Create a check by providing:
- Client ID
- Live Photo ID 
- Document ID
- Check type

## Example Request
The following example shows how to create a check using the IDs from previous steps.

```javascript
const check = await complycube.check.create("5eb04fcd0f3e360008035eb1", {
        livePhotoId: "5eb1b5f231778a0008d1c3f6",
        documentId: "5ebd40714f23960008c81527",
        type: "identity_check"
});
```

### Example Response

The response will contain an `id` (the Check ID). It is required for the next step.

```json
{
    "id": "65c12a6426d2ab000814037e",
    "entityName": "John Doe",
    "type": "identity_check",
    "clientId": "5eb04fcd0f3e360008035eb1",
    "livePhotoId": "5eb1b5f231778a0008d1c3f6",
    "documentId": "5ebd40714f23960008c81527",
    "status": "pending",
    "createdAt": "2020-01-04T17:25:21.116Z",
    "updatedAt": "2020-01-04T17:25:21.116Z"
}
```

# 6. Retrieve outcome

ComplyCube will perform the check. You can retrieve a check's outcome and breakdown via the API.

If you have set up webhooks ([see documentation](https://docs.complycube.com/documentation/guides/webhooks)), a notification is sent upon completion of the check.

## Example Request
The following example shows how to retrieve the check outcome:

```javascript
const check = await complycube.check.get("5ebd40714f23960008c81527");
```

### Example Response

The response will contain details about the check outcome, including facial analysis and authenticity verification results.

```json
{
   "id": "5e94b88a01bce00008c86f06",
   "entityName": "John Doe",
   "type": "identity_check",
   "clientId": "5e94b75d01bce00008c86f02",
   "documentId": "5e94b87b01bce00008c86f03",
   "livePhotoId": "5e94b88901bce00008c86f05",
   "status": "complete",
   "result": {
      "outcome": "clear",
      "breakdown": {
         "faceAnalysis": {
            "faceDetection": "clear",
            "facialSimilarity": "clear",
            "breakdown": {
               "facialSimilarityScore": 100
            }
         },
         "authenticityAnalysis": {
            "spoofedImageAnalysis": "clear",
            "livenessCheck": "clear",
            "breakdown": {
               "livenessCheckScore": 100
            }
         },
         "integrityAnalysis": {
            "faceDetection": "clear"
         }
      }
   },
   "createdAt": "2020-01-04T17:25:21.116Z",
   "updatedAt": "2020-01-04T17:25:21.116Z"
}
```
