import { Injectable, inject } from '@angular/core';
import { Firestore, collectionData, docData } from '@angular/fire/firestore';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, DocumentReference, getDocs, arrayUnion, getDoc } from 'firebase/firestore';
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
    locationName?: string;
    googleMapsLink?: string;
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

export interface GiftGroup {
    id?: string;
    eventId: string;
    name: string;
    adminId: string;
    memberIds: string[];
    maxPerPerson?: number;
    isClosed?: boolean;
}

export interface Gift {
    id?: string;
    title: string;
    price?: number;
    url?: string;
    eventId?: string; // Optional because wishlist items don't have eventId yet
    suggestedBy: string; // UID
    assignedTo?: string | null; // UID or 'GROUP'
    groupId?: string; // The group this gift belongs to
    purchaseType?: 'individual' | 'group';
    groupParticipants?: string[]; // UIDs (Legacy, to be deprecated in favor of GiftGroup?) -> Let's keep for backward compat or just use groupId
    payerId?: string; // UID
    origin?: 'wishlist' | 'manual';
    originalOwnerId?: string; // UID of the user whose wishlist this came from
    originalWishlistId?: string; // Firestore ID of the wishlist item
}

@Injectable({
    providedIn: 'root'
})
export class EventsService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private contactsService = inject(ContactsService);

    constructor() { }

    private isEventInFuture(event: TribuEvent): boolean {
        if (!event.date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let eventDate: Date;
        if (event.date && typeof event.date.toDate === 'function') {
            eventDate = event.date.toDate();
        } else if (event.date && event.date.seconds) {
            eventDate = new Date(event.date.seconds * 1000);
        } else {
            eventDate = new Date(event.date); // Fallback for ISO strings or other formats
        }

        return eventDate >= today;
    }


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
                        originalOwnerId: uid,
                        originalWishlistId: docSnap.id // Store reference
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
        const docRef = await addDoc(collection(this.firestore, 'users', uid, 'wishlist'), {
            title: gift.title,
            price: gift.price || 0,
            url: gift.url || ''
        });

        // Sync with future events where I am honoree
        const eventsRef = collection(this.firestore, 'eventos');
        const q = query(eventsRef, where('honoreeIds', 'array-contains', uid));
        const snapshot = await getDocs(q);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const batchPromises: Promise<any>[] = [];
        snapshot.forEach(docSnap => {
            const event = docSnap.data() as TribuEvent;

            if (this.isEventInFuture(event)) {
                batchPromises.push(addDoc(collection(this.firestore, 'regalos'), {
                    title: gift.title,
                    price: gift.price || 0,
                    url: gift.url || '',
                    eventId: docSnap.id,
                    suggestedBy: uid,
                    assignedTo: null,
                    purchaseType: 'individual',
                    origin: 'wishlist',
                    originalOwnerId: uid,
                    originalWishlistId: docRef.id
                }));
            }
        });

        await Promise.all(batchPromises);
        return docRef;
    }

    getWishlist(uid: string): Observable<Gift[]> {
        const ref = collection(this.firestore, 'users', uid, 'wishlist');
        return collectionData(ref, { idField: 'id' }) as Observable<Gift[]>;
    }

    async deleteFromWishlist(uid: string, giftId: string) {
        // Sync delete from events
        // Find gifts in events that came from this wishlist item
        const giftsRef = collection(this.firestore, 'regalos');
        const q = query(giftsRef, where('originalWishlistId', '==', giftId), where('originalOwnerId', '==', uid));
        const snapshot = await getDocs(q);

        // Cache for events to avoid repetitive reads
        const eventCache = new Map<string, TribuEvent>();

        const deletePromises = snapshot.docs.map(async d => {
            const data = d.data() as Gift;

            if (!data.eventId) return Promise.resolve();

            let event = eventCache.get(data.eventId);
            if (!event) {
                const eventSnap = await getDoc(doc(this.firestore, 'eventos', data.eventId));
                if (eventSnap.exists()) {
                    event = eventSnap.data() as TribuEvent;
                    eventCache.set(data.eventId, event);
                }
            }

            if (event && !this.isEventInFuture(event)) {
                // Event is in the past, DO NOT delete content to preserve history
                return Promise.resolve();
            }

            // Only delete if NOT assigned or reserved (to avoid messing up active gifts)
            if (!data.assignedTo && !data.payerId && (!data.purchaseType || data.purchaseType === 'individual')) {
                return deleteDoc(d.ref);
            }
            return Promise.resolve();
        });
        await Promise.all(deletePromises);

        return deleteDoc(doc(this.firestore, 'users', uid, 'wishlist', giftId));
    }

    async updateWishlistItem(uid: string, giftId: string, updates: Partial<Gift>) {
        const docRef = doc(this.firestore, 'users', uid, 'wishlist', giftId);
        await updateDoc(docRef, updates);

        // Sync with events where this item was copied
        const giftsRef = collection(this.firestore, 'regalos');
        const q = query(giftsRef, where('originalWishlistId', '==', giftId), where('originalOwnerId', '==', uid));
        const snapshot = await getDocs(q);

        // Cache for events to avoid repetitive reads
        const eventCache = new Map<string, TribuEvent>();

        const updatePromises = snapshot.docs.map(async d => {
            const data = d.data() as Gift;

            if (!data.eventId) return Promise.resolve();

            let event = eventCache.get(data.eventId);
            if (!event) {
                const eventSnap = await getDoc(doc(this.firestore, 'eventos', data.eventId));
                if (eventSnap.exists()) {
                    event = eventSnap.data() as TribuEvent;
                    eventCache.set(data.eventId, event);
                }
            }

            if (event && !this.isEventInFuture(event)) {
                // Event is in the past, DO NOT update content to preserve history
                return Promise.resolve();
            }

            // Only update if not assigned (or maybe update anyway? usually safe to update details like URL/Title if not bought)
            // But if it's assigned, maybe the user bought the specific version. 
            // However, usually we want to correct typos etc. 
            // Let's update if it is not GROUP bought (where title might have been customized? No, title matches).
            // Let's safe-guard: if it's assigned, we might still want to update info unless it conflicts.
            // Requirement: "quiero que se actualice la lista de posibles regalos" implies availability list mainly, but details too.
            // Let's trust updates should propagate unless it breaks something.

            // Check if updates contains relevant fields
            const safeUpdates: any = {};
            if (updates.title) safeUpdates.title = updates.title;
            if (updates.price) safeUpdates.price = updates.price;
            if (updates.url) safeUpdates.url = updates.url;

            if (Object.keys(safeUpdates).length > 0) {
                return updateDoc(d.ref, safeUpdates);
            }
            return Promise.resolve();
        });
        await Promise.all(updatePromises);
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
        const batchPromises: Promise<any>[] = [];
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

    async getAllMyDebts(): Promise<Debt[]> {
        const user = this.authService.currentUser;
        if (!user) return [];

        const debtsRef = collection(this.firestore, 'deudas');

        // Query 1: Debts I owe
        const q1 = query(debtsRef, where('fromUid', '==', user.uid), where('isPaid', '==', false));
        const snap1 = await getDocs(q1);
        const debts1 = snap1.docs.map(d => ({ id: d.id, ...d.data() } as Debt));

        // Query 2: Debts owed to me
        const q2 = query(debtsRef, where('toUid', '==', user.uid), where('isPaid', '==', false));
        const snap2 = await getDocs(q2);
        const debts2 = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Debt));

        return [...debts1, ...debts2];
    }

    async settleDebts(debtIds: string[]) {
        const batchPromises = debtIds.map(id => {
            const docRef = doc(this.firestore, 'deudas', id);
            return updateDoc(docRef, { isPaid: true });
        });
        await Promise.all(batchPromises);
    }

    async markDebtAsPaid(debtId: string, isPaid: boolean) {
        const docRef = doc(this.firestore, 'deudas', debtId);
        await updateDoc(docRef, { isPaid });
    }
    async addParticipants(eventId: string, newParticipantIds: string[]) {
        const eventRef = doc(this.firestore, 'eventos', eventId);

        // Prepare updates
        const updates: any = {};

        // 1. Add to participantIds array
        // We can't use arrayUnion with other field updates easily in one go if we rely on the current data structure 
        // effectively without reading first, but since we have the ID, we can use arrayUnion.
        // However, we also need to update participationStatus map.

        // Let's rely on reading the document first to be safe or use arrayUnion + dot notation for map
        // Since we need to update a map, we can just use updateDoc with dot notation for the map keys

        const updateObject: any = {
            participantIds: arrayUnion(...newParticipantIds)
        };

        newParticipantIds.forEach(uid => {
            updateObject[`participationStatus.${uid}`] = 'pending';
        });

        await updateDoc(eventRef, updateObject);
    }

    async updateEvent(eventId: string, data: Partial<TribuEvent>) {
        const ref = doc(this.firestore, 'eventos', eventId);
        await updateDoc(ref, data);
    }

    // --- GIFT GROUPS ---

    async createGiftGroup(eventId: string, name: string, memberIds: string[], maxPerPerson?: number) {
        const user = this.authService.currentUser;
        if (!user) throw new Error('Not authenticated');

        return addDoc(collection(this.firestore, 'gift_groups'), {
            eventId,
            name,
            adminId: user.uid,
            memberIds,
            maxPerPerson: maxPerPerson || null,
            isClosed: false,
            createdAt: new Date()
        });
    }

    async joinGiftGroup(groupId: string) {
        const user = this.authService.currentUser;
        if (!user) return;
        const ref = doc(this.firestore, 'gift_groups', groupId);
        await updateDoc(ref, {
            memberIds: arrayUnion(user.uid)
        });
    }

    async removeMemberFromGroup(groupId: string, memberId: string) {
        const ref = doc(this.firestore, 'gift_groups', groupId);
        // Note: Firestore arrayRemove removes instances of the value
        // We typically treat memberId as string UID
        const currentGroup = await getDocs(query(collection(this.firestore, 'gift_groups'), where('__name__', '==', groupId))); // or just read doc?
        // Simpler: just update. Security rules allow event participants to update group.
        // We enforce "Admin Only" in UI, but to be safe, rules should ideally check.
        // For MVP, UI restriction is key.

        // Wait, arrayRemove needs import
        // To avoid managing imports in this Replace block if I missed it, let's use the existing imports if arrayRemove is there.
        // I see arrayUnion is imported in line 2. I need to check if arrayRemove is imported.
        // It is not in the original file view I saw earlier (only arrayUnion).
        // So I must add it to imports or use a different way (read-modify-write).
        // Read-modify-write is safer for logic checks anyway.

        const docSnap = await import('@angular/fire/firestore').then(m => m.getDoc(ref));
        if (docSnap.exists()) {
            const data = docSnap.data() as GiftGroup;
            const newMembers = data.memberIds.filter(id => id !== memberId);
            await updateDoc(ref, { memberIds: newMembers });
        }
    }

    getEventGiftGroups(eventId: string): Observable<GiftGroup[]> {
        const ref = collection(this.firestore, 'gift_groups');
        const q = query(ref, where('eventId', '==', eventId));
        return collectionData(q, { idField: 'id' }) as Observable<GiftGroup[]>;
    }

    getGroupGifts(groupId: string): Observable<Gift[]> {
        const ref = collection(this.firestore, 'regalos');
        const q = query(ref, where('groupId', '==', groupId));
        return collectionData(q, { idField: 'id' }) as Observable<Gift[]>;
    }

    async addGiftToGroup(groupId: string, eventId: string, gift: Partial<Gift>) {
        const user = this.authService.currentUser;
        if (!user) throw new Error('Not authenticated');

        return addDoc(collection(this.firestore, 'regalos'), {
            ...gift,
            groupId,
            eventId, // Required for security rules and querying
            suggestedBy: user.uid,
            purchaseType: 'group',
            assignedTo: 'GROUP',
            origin: 'manual'
        });
    }

    async assignGiftToGroup(groupId: string, giftId: string) {
        const ref = doc(this.firestore, 'regalos', giftId);
        await updateDoc(ref, {
            groupId: groupId,
            assignedTo: 'GROUP',
            purchaseType: 'group',
            payerId: null // Reset payer as it's now a group expense
        });
    }

    async getAvailableEventGifts(eventId: string): Promise<Gift[]> {
        const giftsRef = collection(this.firestore, 'regalos');
        // We want gifts in this event that are NOT assigned and NOT in a group
        // Firestore limitation: != null filter is tricky.
        // We can query by eventId and filter client side for better flexibility or use composite index.
        // Let's filter client side for MVP simplicity if list is small, or use assignedTo == null
        const q = query(giftsRef, where('eventId', '==', eventId));
        const snapshot = await getDocs(q);
        const allGifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Gift));

        return allGifts.filter(g =>
            !g.assignedTo && // Not reserved by anyone
            (!g.purchaseType || g.purchaseType === 'individual') && // Not already group
            !g.groupId // Redundant check but safe
        );
    }

    async setGiftPayer(giftId: string, payerId: string | null) {
        const ref = doc(this.firestore, 'regalos', giftId);
        await updateDoc(ref, { payerId });
    }

    async closeGroupAndGenerateDebts(group: GiftGroup, gifts: Gift[]) {
        if (group.isClosed) return;
        if (!group.id) return;
        if (group.memberIds.length === 0) return;

        // 1. Calculate Totals
        let totalSpent = 0;
        const paidBy: Record<string, number> = {}; // uid -> amount paid
        group.memberIds.forEach(uid => paidBy[uid] = 0);

        gifts.forEach(gift => {
            const price = gift.price || 0;
            totalSpent += price;
            if (gift.payerId && paidBy.hasOwnProperty(gift.payerId)) {
                paidBy[gift.payerId] += price;
            }
        });

        const sharePerPerson = totalSpent / group.memberIds.length;

        // 2. Calculate Net Position (Positive = Creditor, Negative = Debtor)
        const netPositions: { uid: string, amount: number }[] = [];
        group.memberIds.forEach(uid => {
            const paid = paidBy[uid] || 0;
            const net = paid - sharePerPerson;
            if (Math.abs(net) > 0.01) { // Ignore tiny rounding errors
                netPositions.push({ uid, amount: net });
            }
        });

        // 3. Match Debtors to Creditors
        const debtors = netPositions.filter(p => p.amount < 0).sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
        const creditors = netPositions.filter(p => p.amount > 0).sort((a, b) => b.amount - a.amount); // Descending (most positive first)

        const newDebts: any[] = [];
        let i = 0; // debtor index
        let j = 0; // creditor index

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];

            const debtAmount = Math.min(Math.abs(debtor.amount), creditor.amount);

            // Create Debt Record
            newDebts.push({
                eventId: group.eventId,
                giftId: group.id, // We link debt to the Group ID generically or custom title
                giftTitle: `Bote: ${group.name}`,
                fromUid: debtor.uid,
                toUid: creditor.uid,
                amount: parseFloat(debtAmount.toFixed(2)),
                isPaid: false
            });

            // Adjust remaining amounts
            debtor.amount += debtAmount;
            creditor.amount -= debtAmount;

            if (Math.abs(debtor.amount) < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        // 4. Batch Write
        const batchPromises = newDebts.map(d => addDoc(collection(this.firestore, 'deudas'), d));
        await Promise.all(batchPromises);

        // 5. Close Group
        const groupRef = doc(this.firestore, 'gift_groups', group.id);
        await updateDoc(groupRef, { isClosed: true });
    }
}
