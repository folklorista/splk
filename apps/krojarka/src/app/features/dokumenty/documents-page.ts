import { Component } from '@angular/core';
import { AttachmentGallery } from './attachment-gallery';

@Component({ selector: 'app-documents-page', imports: [AttachmentGallery], template: '<app-attachment-gallery title="Dokumenty krojového fondu" />' })
export class DocumentsPage {}
