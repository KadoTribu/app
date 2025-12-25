import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    private authService = inject(AuthService);
    private router = inject(Router);

    canActivate(): Observable<boolean | UrlTree> {
        return this.authService.user$.pipe(
            take(1),
            switchMap(user => {
                if (!user) {
                    return of(this.router.createUrlTree(['/login']));
                }
                // Check if user has phone number (onboarding complete)
                return this.authService.userProfile$.pipe(
                    take(1),
                    map(profile => {
                        if (profile && profile.phoneNumber) {
                            return true;
                        } else {
                            return this.router.createUrlTree(['/onboarding']);
                        }
                    })
                );
            })
        );
    }
}
