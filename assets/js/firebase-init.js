(() => {
  // Replace these with the values from your Firebase project's web app
  // config (Firebase console → Project settings → General → Your apps →
  // SDK setup and configuration → Config). These are meant to be public —
  // Firebase secures data via Firestore security rules, not by hiding this.
  const firebaseConfig = {
    apiKey: 'AIzaSyA3kACkp_gqQWW53c8pcAoW69NLEKydJtk',
    authDomain: 'gatherngo-aa356.firebaseapp.com',
    projectId: 'gatherngo-aa356',
    storageBucket: 'gatherngo-aa356.firebasestorage.app',
    messagingSenderId: '327148600425',
    appId: '1:327148600425:web:684047e8e0e7d63d95f6f8',
  };

  window.GNG_FIREBASE_CONFIGURED = firebaseConfig.apiKey !== 'REPLACE_WITH_YOUR_FIREBASE_API_KEY';

  firebase.initializeApp(firebaseConfig);
  window.GNGAuth = firebase.auth();
  window.GNGDb = firebase.firestore();
})();
