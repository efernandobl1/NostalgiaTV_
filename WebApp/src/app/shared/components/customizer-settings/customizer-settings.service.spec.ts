import { TestBed } from '@angular/core/testing';

import { CustomizerSettingsService } from './customizer-settings.service';

describe('CustomizerSettingsService', () => {
    let service: CustomizerSettingsService;

    beforeEach(() => {
        localStorage.removeItem('isDarkTheme');
        TestBed.configureTestingModule({});
        service = TestBed.inject(CustomizerSettingsService);
    });

    afterEach(() => {
        localStorage.removeItem('isDarkTheme');
        document.body.classList.remove('dark-theme');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('applies the default dark theme to the body so overlays inherit it', () => {
        expect(service.isDark()).toBe(true);
        expect(document.body.classList.contains('dark-theme')).toBe(true);
    });

    it('restores the selected theme after reload', () => {
        service.toggleTheme();
        expect(localStorage.getItem('isDarkTheme')).toBe('false');
        const restored = new CustomizerSettingsService();
        expect(restored.isDark()).toBe(false);
        expect(document.body.classList.contains('dark-theme')).toBe(false);
        restored.toggleTheme();
        expect(document.body.classList.contains('dark-theme')).toBe(true);
    });
});
