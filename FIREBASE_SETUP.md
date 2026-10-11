# Firebase setup

This project keeps the original Java OOP files and uses Firebase Firestore for
the web presentation. Anonymous Firebase Authentication provides a stable user
ID for this local demo. No Cloud Functions, Resend, MySQL, or external email
service is required.

## First-time Firebase setup

1. Open [Firebase Console](https://console.firebase.google.com/) and select the
   project whose Web App values are in `.env`.
2. Create a Cloud Firestore database.
3. In **Authentication -> Sign-in method**, enable **Anonymous**.
4. Publish the included rules:

   ```text
   npx firebase-tools login
   npx firebase-tools use YOUR_FIREBASE_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules
   ```

5. From the project folder run:

   ```text
   npm install
   npm run dev
   ```

6. Open `http://localhost:5173`.

## Firestore collections

- `donors`: donor profile, optional email, `available`, `currentlyAssigned`, and `ownerId`
- `bloodStock/current`: the eight-group stock map
- `bloodRequests`: requester details, status, selected donor, and selection timestamp
- `users/{uid}`: optional manually-created role document, for example
  `{ "role": "admin" }`

The UI displays a demo notification after donor selection and approval:

```text
Demo email marked as sent
```

This is only a presentation message. It does not send a real email and does
not require the Firebase Blaze plan. Donor and requester email fields are
optional and are retained only for display in the demo.

## Test workflow

1. Add two donors. Leave Donor A available and set Donor B to **Not available**.
2. Create a blood request and select it in **Search Donor**.
3. Search the matching blood group. Donor A has an enabled **Select Donor**
   button; Donor B does not.
4. Select Donor A and confirm. The request becomes `donor_selected`, the donor
   is marked `currentlyAssigned`, and the UI shows the demo email message.
5. Add enough blood stock and approve the request. Stock is deducted and the UI
   shows the demo approval email message.
6. Complete or reject the request to release `currentlyAssigned`.
