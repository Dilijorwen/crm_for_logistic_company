/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export { useChatsVariableContext } from './model/useChatsVariableContext';
export {
  createDirectChat,
  createGroupChat,
  addChatMembers,
  leaveChat,
  removeChatMember,
  deleteChat,
  updateGroupChat,
} from './api/chatsApi';
export { errorMessage } from './api/apiResponse';
export { useChatUsers } from './model/useChatUsers';
export {
  type ChatListItem,
  type ChatType,
  type ChatDetails,
  type ChatAttachment,
  type ChatMessage,
} from './model/types';
export { downloadChatAttachment } from './api/attachmentsApi';
export { useAttachmentPreview } from './model/useAttachmentPreview';
export { useChatDetails } from './model/useChatDetails';
export { useChatMessages } from './model/useChatMessages';
export { useChatList } from './model/useChatList';
export { CHAT_REFRESH_EVENT, dispatchChatRefresh } from './lib/chatEvents';
export { attachmentPreviewKind } from './lib/attachmentPreview';
export { formatFileSize } from './lib/formatFileSize';
export { formatSystemMessage } from './lib/formatSystemMessage';
