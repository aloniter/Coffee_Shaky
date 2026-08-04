# Connect Coffee Shaky to Firebase (Firestore)

The app now uses Firestore instead of Supabase. Firestore on the free Spark plan
never pauses, so there is nothing to reactivate every week.

## One-time setup (~15 minutes)

1. Go to https://console.firebase.google.com and click **Add project**.
   Name it anything (e.g. `coffee-shaky`). You can skip Google Analytics.

2. In the left sidebar open **Build > Firestore Database** and click
   **Create database**.
   - Mode: **Start in production mode** (the rules below replace the defaults).
   - Location: pick the region closest to you, e.g. `europe-west1`.
     This cannot be changed later.

3. Register the web app: click the **gear icon > Project settings**, scroll to
   **Your apps**, and click the web icon (`</>`). Give it a nickname and
   register. Do **not** enable Firebase Hosting unless you want it.

4. Copy the `firebaseConfig` values shown and paste them into
   `firebase-config.js`, replacing every `PASTE_..._HERE` placeholder.

5. Publish the security rules. Either paste the contents of `firestore.rules`
   into **Firestore Database > Rules** in the console and click **Publish**, or
   run from this folder:

```bash
npx firebase-tools deploy --only firestore:rules
```

6. Reload the app and submit a test order. The status pill at the top should read
   `מחובר לשרת ✓`, and the order should appear instantly in every open browser.

The `coffee_orders` collection is created automatically by the first order — you
do not need to create it by hand.

## Free tier

Spark plan gives 50,000 document reads and 20,000 writes per day, and 1 GiB of
storage. A family coffee app uses a tiny fraction of that. No credit card, and
no pausing for inactivity.

## Security note

Same as before: the app has no sign-in, so `firestore.rules` lets anyone with
the URL read, create, update, and delete orders. The rules do enforce the shape
of an order and restrict updates to the `status` field only, so the collection
cannot be used as free storage by a stranger who finds your project id. Treat
the app URL as the only thing keeping it private.

The values in `firebase-config.js` are meant to be public — Firebase web configs
are not secrets. Never put a service-account JSON or admin private key in this
folder.

## Deploying

The app is a set of static files served by GitHub Pages from the `main` branch
of `aloniter/Coffee_Shaky`, at https://aloniter.github.io/Coffee_Shaky/.
Pushing to `main` publishes; the rebuild takes about a minute.

Firebase is used only for Firestore — there is no Firebase Hosting.

Security rules live in `firestore.rules` and are **not** deployed by pushing to
GitHub. Publish them either in the Firebase Console under
Firestore Database > Rules, or from this folder:

```bash
npx firebase-tools deploy --only firestore:rules
```

Supabase was the previous backend and has been removed. To see how it worked,
check the git history before the Firestore migration commit.
