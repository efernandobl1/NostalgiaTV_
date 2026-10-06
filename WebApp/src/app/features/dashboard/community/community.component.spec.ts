import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CommunityComponent } from './community.component';
import { BroadcastAdminService, ModeratedComment } from '../broadcast-admin.service';

describe('CommunityComponent', () => {
  it('distinguishes channel and series comments even when their database IDs match', () => {
    const channel: ModeratedComment = { id: 1, channelId: 2, channelName: 'Jetix', author: 'Viewer', body: 'Memory', status: 'Pending', createdAtUtc: new Date().toISOString() };
    const series: ModeratedComment = { ...channel, channelId: undefined, channelName: undefined, seriesId: 3, seriesName: 'Retro series' };
    const action = new Subject<void>();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: BroadcastAdminService, useValue: {
      comments: () => of({ items: [channel, series], totalCount: 2 }), moderate: () => action,
    } }] });
    const fixture = TestBed.createComponent(CommunityComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.comment-note')).toHaveLength(2);
    fixture.componentInstance.moderate(channel, 'Approved'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(fixture.componentInstance.busy()).toBe('channel-1');
    action.next();
    expect(fixture.componentInstance.busy()).toBeNull();
  });
});
