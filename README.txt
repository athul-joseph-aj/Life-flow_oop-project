BLOOD BANK MANAGEMENT SYSTEM
============================

This project contains:

1. The original Java OOP console application in Main.java.
2. A Firebase Firestore web application using HTML, CSS, JavaScript, and Vite.

The website stores donors, blood stock, requests, and donor availability in
Cloud Firestore. Email notifications are represented by demo confirmation
messages in the UI; no email service or Blaze plan is required.

FIREBASE WEB APPLICATION SETUP
------------------------------

Prerequisites:
- Node.js 18 or newer
- A Firebase project with a registered Web App
- Cloud Firestore enabled
- Anonymous Authentication enabled for the local presentation

The Firebase Web App values are stored in the local .env file. Do not commit
.env to source control. The required variable names are documented in
.env.example.

Install dependencies from this folder:

   npm install

Start the development website:

   npm run dev

Open:

   http://localhost:5173

Build the website:

   npm run build

The application imports Firebase's modular JavaScript SDK and initializes
Firestore using the VITE_FIREBASE_* environment variables. The data adapter is
src/main/resources/static/storage.js. The UI remains in script.js and keeps
the existing donor, stock, request, and search features.

See FIREBASE_SETUP.md for Firestore rules and the donor-selection -> approval
demo workflow.

DATA FLOW
---------

Form input -> JavaScript validation -> Firestore adapter -> Cloud Firestore
                                      -> dashboard/table refresh
                                      -> demo notification message in the UI

Collections/documents used:
- donors: one document per donor
- bloodStock/current: one document containing the eight blood-group totals
- bloodRequests: one document per request

After donor selection or request approval, the UI displays a demo message that
the notification email was sent. No real email is sent.

ORIGINAL OOP CONSOLE PROJECT
----------------------------

The original Java files are preserved. Run them independently with:

   javac Main.java
   java Main

VIVA CONCEPTS:
- Abstraction: Person is abstract.
- Inheritance: Donor extends Person.
- Polymorphism: Donor overrides displayInfo().
- Encapsulation: private fields with getters and methods.
- Collections: ArrayList and HashMap are used in the original BloodBank.
- Exception handling: invalid console input is handled with try/catch.
