import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, docData } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    phoneNumber?: string | null;
    photoURL?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    private firestore: Firestore = inject(Firestore);
    private router: Router = inject(Router);

    user$ = user(this.auth);

    get currentUser() {
        return this.auth.currentUser;
    }


    // Observable that emits true if user has completed onboarding (has phone number)
    userProfile$ = this.user$.pipe(
        switchMap(u => {
            if (u) {
                return docData(doc(this.firestore, 'users', u.uid)) as Observable<UserProfile>;
            } else {
                return of(null);
            }
        })
    );

    constructor() { }

    async loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/contacts.readonly');

        try {
            const result = await signInWithPopup(this.auth, provider);
            // Retrieve the Google Access Token
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem('google_access_token', credential.accessToken);
            }

            await this.ensureUserRecord(result.user);
            return result.user;
        } catch (e) {
            console.error('Google Login Error', e);
            throw e;
        }
    }

    async logout() {
        await signOut(this.auth);
        this.router.navigate(['/login']);
    }

    private async ensureUserRecord(user: User) {
        const userDocRef = doc(this.firestore, 'users', user.uid);
        const snapshot = await getDoc(userDocRef);
        if (!snapshot.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                // phoneNumber is intentionally omitted to trigger onboarding
            });
        }
    }

    async updateUserPhone(uid: string, phoneNumber: string) {
        const userDocRef = doc(this.firestore, 'users', uid);
        await setDoc(userDocRef, { phoneNumber }, { merge: true });
    }

    async updateProfile(uid: string, data: { displayName?: string; photoURL?: string; phoneNumber?: string }) {
        const userDocRef = doc(this.firestore, 'users', uid);
        await setDoc(userDocRef, data, { merge: true });
        // Also update Auth profile if possible (optional but good for consistency)
        // updateProfile(this.auth.currentUser!, data)
    }

    isLoggedIn(): boolean {
        return !!this.auth.currentUser;
    }

    async getUserProfile(uid: string): Promise<UserProfile | undefined> {
        const docRef = doc(this.firestore, 'users', uid);
        const snapshot = await getDoc(docRef);
        return snapshot.data() as UserProfile | undefined;
    }
}
