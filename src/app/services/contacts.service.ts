import { Injectable, inject } from '@angular/core';
import { Platform } from '@ionic/angular/standalone';
import { Contacts } from '@capacitor-community/contacts';
import { Firestore, docData, doc, setDoc, deleteDoc } from '@angular/fire/firestore'; // Updated imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Share } from '@capacitor/share';
import { AuthService } from './auth.service';

export interface AppContact {
    name: string;
    phone: string;
    isRegistered?: boolean; // True if found in Firebase
    photoURL?: string; // If registered
    uid?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ContactsService {
    private platform = inject(Platform);
    private firestore = inject(Firestore);
    private authService = inject(AuthService);

    private allRawContacts: { name: string, phone: string }[] = [];

    constructor() { }

    async initContacts(): Promise<void> {
        let rawContacts: { name: string, phone: string }[] = [];

        // 0. Load Saved Tribe Contacts (Persistence)
        const user = this.authService.currentUser;
        if (user) {
            try {
                // Determine collection ref. Since we mix imports, we need to be careful.
                // inject(Firestore) returns a Firestore instance compatible with modular SDK.
                // collection() accepts that instance.
                const savedRef = collection(this.firestore, 'users', user.uid, 'savedContacts');
                const snapshot = await getDocs(savedRef);
                const savedContacts = snapshot.docs.map(d => {
                    const data = d.data() as AppContact;
                    return { name: data.name, phone: this.normalizePhone(data.phone) };
                });
                rawContacts = [...rawContacts, ...savedContacts];
            } catch (e) {
                console.warn('Error loading saved contacts', e);
            }
        }

        // 1. Load Manual Contacts
        const manualContacts = this.getManualContactsFromStorage();
        rawContacts = [...rawContacts, ...manualContacts];

        if (this.platform.is('capacitor')) {
            // Native
            const permission = await Contacts.requestPermissions();
            if (permission.contacts === 'granted') {
                const result = await Contacts.getContacts({
                    projection: {
                        name: true,
                        phones: true
                    }
                });
                const deviceContacts = result.contacts
                    .filter(c => c.phones && c.phones.length > 0)
                    .map(c => ({
                        name: c.name?.display || 'Desconocido',
                        phone: this.normalizePhone(c.phones![0].number!)
                    }));
                rawContacts = [...rawContacts, ...deviceContacts];
            }
        } else {
            // Web: Try Google Contacts if token exists
            try {
                const googleContacts = await this.getGoogleContacts();
                rawContacts = [...rawContacts, ...googleContacts];
            } catch (e) {
                console.warn('Google Contacts sync failed', e);
            }

            // Web (Contact Picker API or Mock)
            if ('contacts' in navigator && 'ContactsManager' in window) {
                try {
                    const props = ['name', 'tel'];
                    const opts = { multiple: true };
                    const contacts = await (navigator as any).contacts.select(props, opts);
                    const webContacts = contacts.map((c: any) => ({
                        name: c.name[0],
                        phone: this.normalizePhone(c.tel[0])
                    }));
                    rawContacts = [...rawContacts, ...webContacts];
                } catch (e) {
                    console.log('Contact Picker failed or cancelled', e);
                }
            }

            if (rawContacts.length === 0) {
                // Fallback Mock for development
                rawContacts = [
                    ...rawContacts, // Keep saved contacts
                    { name: 'Alice (Demo)', phone: '+34600111222' },
                    { name: 'Bob (Demo)', phone: '+34600333444' }
                ];
            }
        }

        // Deduplicate and Sort
        this.allRawContacts = Array.from(new Map(rawContacts.map(item => [item.phone, item])).values());
        this.allRawContacts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }

    async getContactsPage(offset: number, limit: number, queryStr: string = ''): Promise<AppContact[]> {
        let filtered = this.allRawContacts;

        if (queryStr && queryStr.trim() !== '') {
            const q = queryStr.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(q) || c.phone.includes(q)
            );
        }

        const chunk = filtered.slice(offset, offset + limit);
        return await this.matchmaking(chunk);
    }

    // Compatibility method for components needing all contacts (e.g., Create Event Modal)
    async getAllContacts(): Promise<AppContact[]> {
        if (this.allRawContacts.length === 0) {
            await this.initContacts();
        }
        return await this.matchmaking(this.allRawContacts);
    }

    private async getGoogleContacts(): Promise<{ name: string, phone: string }[]> {
        const token = localStorage.getItem('google_access_token');
        if (!token) return [];

        let allConnections: any[] = [];
        let nextPageToken: string | undefined = undefined;

        try {
            do {
                let url = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000';
                if (nextPageToken) {
                    url += `&pageToken=${nextPageToken}`;
                }

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Token expired or invalid
                        localStorage.removeItem('google_access_token');
                    }

                    const errorText = await response.text();
                    // Check for "API not enabled" specific error
                    if (response.status === 403 && errorText.includes('People API has not been used')) {
                        throw {
                            code: 'API_NOT_ENABLED',
                            message: 'La Google People API no está habilitada.',
                            details: errorText
                        };
                    }

                    console.error('Failed to fetch Google Contacts page', errorText);
                    break; // Stop fetching on error
                }

                const data = await response.json();
                if (data.connections) {
                    allConnections = [...allConnections, ...data.connections];
                }

                nextPageToken = data.nextPageToken;

            } while (nextPageToken);

            return allConnections
                .filter((c: any) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.names && c.names.length > 0)
                .map((c: any) => ({
                    name: c.names[0].displayName || 'Sin Nombre',
                    phone: this.normalizePhone(c.phoneNumbers[0].value)
                }));
        } catch (e) {
            console.error('Error fetching Google contacts', e);
            // Re-throw specific API error so the UI can handle it
            if ((e as any).code === 'API_NOT_ENABLED') {
                throw e;
            }
            return [];
        }
    }

    addManualContact(contact: AppContact) {
        const current = this.getManualContactsFromStorage();
        contact.phone = this.normalizePhone(contact.phone);
        current.push(contact);
        localStorage.setItem('manual_contacts', JSON.stringify(current));
    }

    async addContactToTribe(targetUid: string) {
        const currentUser = this.authService.currentUser;
        if (!currentUser) return;

        // Check if already in saved?
        // Just overwrite/merge.
        const profile = await this.authService.getUserProfile(targetUid);
        if (profile && profile.phoneNumber) {
            const contactData: AppContact = {
                name: profile.displayName || 'Amigo de Tribu',
                phone: this.normalizePhone(profile.phoneNumber),
                uid: targetUid,
                photoURL: profile.photoURL || undefined,
                isRegistered: true
            };

            const docRef = doc(this.firestore, 'users', currentUser.uid, 'savedContacts', targetUid);
            await setDoc(docRef, contactData, { merge: true });
        }
    }

    private getManualContactsFromStorage(): AppContact[] {
        const stored = localStorage.getItem('manual_contacts');
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    }

    private normalizePhone(phone: string): string {
        // Basic normalization: remove spaces, dashes. Ensure international format if possible.
        return phone.replace(/\s+/g, '').replace(/-/g, '');
    }

    // Matchmaking: Compare phones with Firestore Users
    private async matchmaking(contacts: { name: string, phone: string }[]): Promise<AppContact[]> {
        const appContacts: AppContact[] = [];
        const phones = contacts.map(c => c.phone);

        // Firestore "in" query limits to 10-30 items depending on rule. 
        // For large lists, we might need to batch or just check one by one on backend.
        // For MVP, we will assume small chunks or we'll iterate.
        // Better approach: Query users collection where phoneNumber IN ... 
        // Chunking to 10

        // Optimization: Just return contacts marked as "unknown" status first, and load status lazily?
        // Let's do simple implementation: Check matches.

        const chunks = this.chunkArray(phones, 10);
        const registeredPhonesMap = new Map<string, any>();

        for (const chunk of chunks) {
            if (chunk.length === 0) continue;
            const q = query(collection(this.firestore, 'users'), where('phoneNumber', 'in', chunk));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data['phoneNumber']) {
                    registeredPhonesMap.set(data['phoneNumber'], data);
                }
            });
        }

        for (const c of contacts) {
            const registered = registeredPhonesMap.get(c.phone);
            appContacts.push({
                name: c.name,
                phone: c.phone,
                isRegistered: !!registered,
                photoURL: registered?.photoURL,
                uid: registered?.uid
            });
        }

        // Sort alphabetically by name
        appContacts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

        return appContacts;
    }

    async updateContact(originalPhone: string, newName: string, newPhone: string, existingUid?: string) {
        const normalizedPhone = this.normalizePhone(newPhone);
        const currentUser = this.authService.currentUser;

        // Check if the new phone belongs to a registered user
        const q = query(collection(this.firestore, 'users'), where('phoneNumber', '==', normalizedPhone));
        const snapshot = await getDocs(q);
        const registeredUser = !snapshot.empty ? snapshot.docs[0].data() : null;

        if (registeredUser && currentUser) {
            // CASE 1: Contact is Registered (or became registered)
            // Save to Firestore 'savedContacts' using their real UID
            const targetUid = registeredUser['uid']; // Typed access

            // If we are changing from one UID to another (rare, but possible), delete old
            if (existingUid && existingUid !== targetUid) {
                await deleteDoc(doc(this.firestore, 'users', currentUser.uid, 'savedContacts', existingUid));
            }

            const docRef = doc(this.firestore, 'users', currentUser.uid, 'savedContacts', targetUid);
            await setDoc(docRef, {
                name: newName,
                phone: normalizedPhone,
                uid: targetUid,
                photoURL: registeredUser['photoURL'] || null,
                isRegistered: true
            }, { merge: true });

            // Remove from manual list if it existed there
            this.removeManualContact(originalPhone);

        } else {
            // CASE 2: Contact is NOT Registered (or lost registration status)
            // It should be in Manual Storage.

            // If it was in Firestore (existingUid), remove it from there
            if (currentUser && existingUid) {
                await deleteDoc(doc(this.firestore, 'users', currentUser.uid, 'savedContacts', existingUid));
            }

            // Update or Add to Manual Storage
            const manualContacts = this.getManualContactsFromStorage();
            const index = manualContacts.findIndex(c => c.phone === originalPhone);

            if (index !== -1) {
                manualContacts[index] = { ...manualContacts[index], name: newName, phone: normalizedPhone };
            } else {
                manualContacts.push({ name: newName, phone: normalizedPhone });
            }
            localStorage.setItem('manual_contacts', JSON.stringify(manualContacts));
        }
    }

    private removeManualContact(phone: string) {
        const manual = this.getManualContactsFromStorage();
        const filtered = manual.filter(c => c.phone !== phone);
        if (manual.length !== filtered.length) {
            localStorage.setItem('manual_contacts', JSON.stringify(filtered));
        }
    }

    async inviteContact(contact: AppContact) {
        await Share.share({
            title: 'Únete a mi Tribu en Kadotribu',
            text: `Hola ${contact.name}, descárgate Kadotribu y únete a mi evento!`,
            url: 'https://kadotribu.app/download', // Placeholder
            dialogTitle: 'Invitar amigo'
        });
    }

    private chunkArray(myArray: any[], chunk_size: number) {
        var results = [];
        while (myArray.length) {
            results.push(myArray.splice(0, chunk_size));
        }
        return results;
    }
}
