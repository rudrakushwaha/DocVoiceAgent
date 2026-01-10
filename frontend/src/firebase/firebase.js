// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import {getAuth} from 'firebase/auth'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCs7_0I8VkxAeJl73yFtq1oVBS37bGghLQ",
   authDomain: "docagent-94609.firebaseapp.com",
  projectId: "docagent-94609",
  storageBucket: "docagent-94609.firebasestorage.app",
  messagingSenderId: "456459906333",
  appId: "1:456459906333:web:25eefcc84c161ca5c3c5f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export {auth, app};