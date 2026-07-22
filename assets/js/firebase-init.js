(() => {
  // Replace these with the values from your Firebase project's web app
  // config (Firebase console → Project settings → General → Your apps →
  // SDK setup and configuration → Config). These are meant to be public —
  // Firebase secures data via Firestore security rules, not by hiding this.
  const firebaseConfig = {
    apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
    authDomain: 'REPLACE_WITH_YOUR_PROJECT.firebaseapp.com',
    projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
    storageBucket: 'REPLACE_WITH_YOUR_PROJECT.appspot.com',
    messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
    appId: 'REPLACE_WITH_YOUR_APP_ID',
  };

  window.GNG_FIREBASE_CONFIGURED = firebaseConfig.apiKey !== 'REPLACE_WITH_YOUR_FIREBASE_API_KEY';

  firebase.initializeApp(firebaseConfig);
  window.GNGAuth = firebase.auth();
  window.GNGDb = firebase.firestore();
})();
