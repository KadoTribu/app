import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebtsPage } from './debts.page';

describe('DebtsPage', () => {
  let component: DebtsPage;
  let fixture: ComponentFixture<DebtsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DebtsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
