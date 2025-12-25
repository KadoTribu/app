import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference, getDocs } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService, UserProfile } from './auth.service';
import { ContactsService } from './contacts.service';

export interface TribuEvent {
    id?: string;
    title: string;
    date: any; // Timestamp
    description?: string;
    organizerId: string;
    participantIds: string[]; // UIDs
    guests?: { name: string, phone: string }[];
    imageUrl?: string;
    honoreeIds?: string[]; // UIDs who are being celebrated
    participationStatus?: Record<string, 'pending' | 'accepted' | 'rejected'>;
}

export interface Debt {
    id?: string;
    eventId: string;
    giftId: string;
    giftTitle: string;
    fromUid: string;
    toUid: string; // Payer
    amount: number;
    isPaid: boolean;
}

export interface Gift {
    id?: string;
    title: string;
    price?: number;
    url?: string;
    eventId?: string; // Optional because wishlist items don't have eventId yet
    suggestedBy: string; // UID
    assignedTo?: string | null; // UID or 'GROUP'
    purchaseType?: 'individual' | 'group';
    groupParticipants?: string[]; // UIDs
    payerId?: string; // UID
    origin?: 'wishlist' | 'manual';
    originalOwnerId?: string; // UID of the user whose wishlist this came from
}

@Injectable({
    providedIn: 'root'
})
export class EventsService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private contactsService = inject(ContactsService);

    constructor() { }

    getMyEvents(): Observable<TribuEvent[]> {
        const user = this.authService.currentUser;
        if (!user) return of([]);
        const eventsRef = collection(this.firestore, 'eventos');
        const q = query(eventsRef, where('participantIds', 'array-contains', user.uid));
        return collectionData(q, { idField: 'id' }) as Observable<TribuEvent[]>;
    }

    getEvent(id: string): Observable<TribuEvent> {
        const docRef = doc(this.firestore, 'eventos', id);
        return docData(docRef, { idField: 'id' }) as Observable<TribuEvent>;
    }

    getEventGifts(eventId: string): Observable<Gift[]> {
        const giftsRef = collection(this.firestore, 'regalos');
        const q = query(giftsRef, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<Gift[]>;
    }

    getEventDebts(eventId: string): Observable<Debt[]> {
        const debtsRef = collection(this.firestore, 'deudas');
        const q = query(debtsRef, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<Debt[]>;
    }

    async createEvent(event: Partial<TribuEvent>) {
        const user = this.authService.currentUser;
        if (!user) throw new Error('Not authenticated');

        const initialStatus: Record<string, 'pending' | 'accepted'> = {};
        initialStatus[user.uid] = 'accepted';
        event.participantIds?.forEach(uid => {
            if (uid !== user.uid) initialStatus[uid] = 'pending';
        });

        const fullEvent = {
            ...event,
            organizerId: user.uid,
            participantIds: [user.uid, ...(event.participantIds || [])],
            createdAt: new Date(),
            guests: event.guests || [],
            honoreeIds: event.honoreeIds || [],
            participationStatus: initialStatus
        };
        const eventRef = await addDoc(collection(this.firestore, 'eventos'), fullEvent);

        if (fullEvent.honoreeIds.length > 0) {
            await this.copyWishlistsToEvent(eventRef.id, fullEvent.honoreeIds);
        }

        return eventRef;
    }

    private async copyWishlistsToEvent(eventId: string, honoreeIds: string[]) {
        for (const uid of honoreeIds) {
            const wishlistRef = collection(this.firestore, 'users', uid, 'wishlist');
            try {
                const snapshot = await getDocs(wishlistRef);
                const batchPromises = snapshot.docs.map(docSnap => {
                    const item = docSnap.data() as Partial<Gift>;
                    return addDoc(collection(this.firestore, 'regalos'), {
                        title: item.title,
                        price: item.price || 0,
                        url: item.url || '',
                        eventId: eventId,
                        suggestedBy: uid,
                        assignedTo: null,
                        purchaseType: 'individual',
                        origin: 'wishlist',
                        originalOwnerId: uid
                    });
                });
                await Promise.all(batchPromises);
            } catch (e) {
                console.warn(`Error copying wishlist for user ${uid}`, e);
            }
        }
    }

    async acceptInvitation(eventId: string, organizerId: string, honoreeIds: string[]) {
        const user = this.authService.currentUser;
        if (!user) return;

        const eventRef = doc(this.firestore, 'eventos', eventId);
        await updateDoc(eventRef, {
            [`participationStatus.${user.uid}`]: 'accepted'
        });

        // Add Organizer to contacts
        if (organizerId !== user.uid) {
            await this.contactsService.addContactToTribe(organizerId);
        }

        // Add Honorees to contacts
        for (const uid of honoreeIds) {
            if (uid !== user.uid) {
                await this.contactsService.addContactToTribe(uid);
            }
        }
    }

    async rejectInvitation(eventId: string) {
        const user = this.authService.currentUser;
        if (!user) return;
        const eventRef = doc(this.firestore, 'eventos', eventId);
        await updateDoc(eventRef, {
            [`participationStatus.${user.uid}`]: 'rejected'
        });
    }

    async addToWishlist(uid: string, gift: Partial<Gift>) {
        return addDoc(collection(this.firestore, 'users', uid, 'wishlist'), {
            title: gift.title,
            price: gift.price || 0,
            url: gift.url || ''
        });
    }

    getWishlist(uid: string): Observable<Gift[]> {
        const ref = collection(this.firestore, 'users', uid, 'wishlist');
        return collectionData(ref, { idField: 'id' }) as Observable<Gift[]>;
    }

    async deleteFromWishlist(uid: string, giftId: string) {
        return deleteDoc(doc(this.firestore, 'users', uid, 'wishlist', giftId));
    }

    async addGift(gift: Partial<Gift>) {
        const user = this.authService.currentUser;
        if (!user) throw new Error('Not authenticated');
        return addDoc(collection(this.firestore, 'regalos'), {
            ...gift,
            suggestedBy: user.uid,
            assignedTo: null,
            purchaseType: 'individual',
            origin: 'manual'
        });
    }

    async reserveGift(giftId: string) {
        const user = this.authService.currentUser;
        if (!user) return;
        const docRef = doc(this.firestore, 'regalos', giftId);
        await updateDoc(docRef, { assignedTo: user.uid, purchaseType: 'individual' });
    }

    async releaseGift(giftId: string) {
        const docRef = doc(this.firestore, 'regalos', giftId);
        await updateDoc(docRef, { assignedTo: null, purchaseType: 'individual', payerId: null, groupParticipants: [] });
    }

    async createGroupGift(giftId: string, giftTitle: string, eventId: string, participantIds: string[], payerId: string, totalPrice: number) {
        if (!totalPrice || participantIds.length === 0) return;

        const amountPerPerson = parseFloat((totalPrice / participantIds.length).toFixed(2));

        // 1. Update Gift
        const giftRef = doc(this.firestore, 'regalos', giftId);
        await updateDoc(giftRef, {
            assignedTo: 'GROUP',
            purchaseType: 'group',
            groupParticipants: participantIds,
            payerId: payerId
        });

        // 2. Create Debts
        const batchPromises = [];
        for (const uid of participantIds) {
            if (uid !== payerId) {
                batchPromises.push(addDoc(collection(this.firestore, 'deudas'), {
                    eventId,
                    giftId,
                    giftTitle,
                    fromUid: uid,
                    toUid: payerId,
                    amount: amountPerPerson,
                    isPaid: false
                }));
            }
        }
        await Promise.all(batchPromises);
    }

    async deleteEvent(eventId: string) {
        const user = this.authService.currentUser;
        if (!user) throw new Error('Not authenticated');

        // 1. Delete Gifts
        const giftsRef = collection(this.firestore, 'regalos');
        const qGifts = query(giftsRef, where('eventId', '==', eventId));
        const giftsSnap = await getDocs(qGifts);
        const giftDeletes = giftsSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(giftDeletes);

        // 2. Delete Debts
        const debtsRef = collection(this.firestore, 'deudas');
        const qDebts = query(debtsRef, where('eventId', '==', eventId));
        const debtsSnap = await getDocs(qDebts);
        const debtDeletes = debtsSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(debtDeletes);

        // 3. Delete Event
        await deleteDoc(doc(this.firestore, 'eventos', eventId));
    }

    async markDebtAsPaid(debtId: string, isPaid: boolean) {
        const docRef = doc(this.firestore, 'deudas', debtId);
        await updateDoc(docRef, { isPaid });
    }
}
