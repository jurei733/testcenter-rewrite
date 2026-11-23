import type {IncomingMessage} from 'node:http';
import {FirstSliceError, formatOriginalAttachmentJson, type FirstSliceServices} from '@testcenter-rewrite-app/application';
import type {UploadAttachmentFileRequest} from '@testcenter-rewrite-app/contracts';
import type {WorkspaceAttachment} from '@testcenter-rewrite-app/domain';

const itemPath = /^\/attachment\/([^/]+)\/(data|page|file)(?:\/([^/]+))?$/;
export function originalAttachmentRouteLabel(method: string, pathname: string): string | null {
  if (pathname === '/attachments/list' || pathname === '/attachments/pages') return method + ' ' + pathname;
  const item = itemPath.exec(pathname);
  if (!item || item[3] && item[2] !== 'file') return null;
  return method + ' /attachment/:attachmentId/' + item[2] + (item[3] ? '/:attachmentFileId' : '');
}

const decodeIdentifier = (segment: string) => {
  try {
    const value = decodeURIComponent(segment);
    if (value && !/[\/\\\x00-\x1f\x7f]/.test(value)) return value;
  } catch { /* Reject malformed paths at the native attachment boundary. */ }
  throw new FirstSliceError(400, 'original_attachment_invalid', 'Invalid attachment identifier.');
};

export async function handleOriginalAttachmentHttp(input: {
  request: IncomingMessage;
  pathname: string;
  searchParams: URLSearchParams;
  services: FirstSliceServices;
  readUpload: () => Promise<UploadAttachmentFileRequest>;
  pdf: (attachments: WorkspaceAttachment[], labelTemplate: string | null) => Promise<Buffer>;
  header: (name: string, value: string) => void;
  json: (status: number, body: string) => void;
  binary: (mediaType: string, body: Buffer, inline: boolean, fileName: string) => void;
}): Promise<boolean> {
  const {request, pathname, services} = input;
  if (!originalAttachmentRouteLabel('', pathname)) return false;
  input.header('cache-control', 'private, no-store');
  const port = services.originalAttachments;
  const token = request.headers.authtoken;
  if (typeof token !== 'string' || !token) {
    throw new FirstSliceError(401, 'original_token_missing', 'Auth Header not sufficient: missing or empty');
  }
  await port.authorize(token);
  const item = itemPath.exec(pathname);
  const operation = item?.[2];
  const fileId = item?.[3];
  const methods = operation === 'file' ? (fileId ? ['GET', 'DELETE'] : ['POST']) : ['GET'];
  if (!methods.includes(request.method ?? '')) {
    input.header('allow', methods.join(', '));
    throw new FirstSliceError(405, 'original_method_not_allowed', 'Method not allowed.');
  }
  const reference = item ? {token, attachmentId: decodeIdentifier(item[1]!)} : null;
  if (pathname === '/attachments/list') {
    const rows = await port.list(token);
    input.json(200, '[' + rows.map(formatOriginalAttachmentJson).join(',') + ']');
  } else if (pathname === '/attachments/pages' || operation === 'page') {
    const label = input.searchParams.get('labelTemplate');
    if (label && label.length > 500) {
      throw new FirstSliceError(400, 'attachment_label_template_too_long', 'Attachment page label templates may contain at most 500 characters.');
    }
    const attachments = (reference ? [await port.page(reference)] : await port.pages(token))
      .filter(attachment => attachment.attachmentType === 'capture-image');
    if (!attachments.length || attachments.length > 500) {
      throw new FirstSliceError(attachments.length ? 400 : 404, 'original_attachment_pages_unavailable',
        'Attachment pages require between one and 500 capture targets.');
    }
    input.binary('application/pdf', await input.pdf(attachments, label), false, 'pages.pdf');
  } else if (reference && operation === 'data') {
    input.json(200, formatOriginalAttachmentJson(await port.get(reference)));
  } else if (reference && request.method === 'POST') {
    await port.get(reference);
    await port.upload(reference, await input.readUpload());
    input.json(201, '');
  } else if (reference && fileId) {
    const parameters = {...reference, attachmentFileId: decodeIdentifier(fileId)};
    if (request.method === 'DELETE') {
      await port.delete(parameters);
      input.json(200, '');
    } else {
      const file = await port.file(parameters);
      input.binary(file.mediaType, Buffer.from(file.dataBase64, 'base64'), true, file.fileName);
    }
  }
  return true;
}
