# VideoTracker 加密云同步方案

## 目标

为观看记录、备注、自定义站点等隐私数据提供端到端加密能力：

- 云端只保存密文，不保存视频标题、URL、观看进度、备注等明文内容
- 新设备登录后，用户可通过同步加密密码恢复云端数据
- 用户修改同步加密密码时，不需要重新加密全部观看记录
- Supabase 继续负责登录、权限校验、密文存储和多设备同步

本方案保护的是应用数据内容。Supabase 仍会知道用户 ID、数据更新时间、密文大小等元数据。

## 非目标

- 不使用 Supabase 登录密码直接加密数据
- 不在云端保存用户同步加密密码
- 不在云端保存明文数据密钥
- 不支持忘记同步加密密码后无条件恢复数据
- 不依赖服务端解密或服务端合并观看记录

## 核心概念

### Data Key

Data Key 是真正用于加密用户隐私数据的随机密钥。

- 由浏览器本地生成
- 256-bit 随机值
- 用于 AES-GCM 加密 `WatchRecord[]`、`CustomSite[]` 等业务数据
- 不以明文形式上传云端

### KEK

KEK 是 Key Encryption Key，用于保护 Data Key。

- 由用户输入的同步加密密码派生
- 使用 PBKDF2 + SHA-256
- 每个用户独立 salt
- 只用于加密和解密 Data Key

### Envelope Encryption

本方案采用信封加密：

```text
WatchRecord[]  -- Data Key 加密 --> encrypted_blob
Data Key       -- KEK 加密 -------> encrypted_data_key
同步密码 + salt -- PBKDF2 -------> KEK
```

云端保存：

- `salt`
- KDF 参数
- `encrypted_data_key`
- `encrypted_blob`

云端不保存：

- 同步加密密码
- KEK
- 明文 Data Key
- 明文观看记录

## 数据加密范围

### 必须加密

- `WatchRecord.url`
- `WatchRecord.title`
- `WatchRecord.episode`
- `WatchRecord.seriesName`
- `WatchRecord.platform`
- `WatchRecord.platformName`
- `WatchRecord.currentTime`
- `WatchRecord.duration`
- `WatchRecord.progress`
- `WatchRecord.thumbnail`
- `WatchRecord.lastWatchedAt`
- `WatchRecord.createdAt`
- `WatchRecord.notes`
- `CustomSite.domain`
- `CustomSite.enabled`
- `CustomSite.addedAt`

### 可明文保存的元数据

- `user_id`
- `updated_at`
- `schema_version`
- `encryption_version`
- `ciphertext_id`

其中 `ciphertext_id` 不能直接由视频 URL、标题或站点域名生成，避免云端通过 ID 推断用户行为。

## 云端表设计

### user_encryption_keys

保存被同步加密密码保护后的 Data Key。

```sql
CREATE TABLE IF NOT EXISTS public.user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  kdf TEXT NOT NULL DEFAULT 'PBKDF2',
  kdf_hash TEXT NOT NULL DEFAULT 'SHA-256',
  kdf_iterations INTEGER NOT NULL DEFAULT 210000,
  salt TEXT NOT NULL,

  encrypted_data_key JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encryption key"
  ON public.user_encryption_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own encryption key"
  ON public.user_encryption_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own encryption key"
  ON public.user_encryption_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own encryption key"
  ON public.user_encryption_keys
  FOR DELETE
  USING (auth.uid() = user_id);
```

`encrypted_data_key` 示例：

```json
{
  "version": 1,
  "algorithm": "AES-GCM",
  "iv": "base64-iv",
  "data": "base64-ciphertext"
}
```

### encrypted_sync_blobs

保存加密后的业务数据。初期建议每个用户一份完整 blob，降低实现复杂度。

```sql
CREATE TABLE IF NOT EXISTS public.encrypted_sync_blobs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  schema_version INTEGER NOT NULL DEFAULT 1,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  encrypted_blob JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.encrypted_sync_blobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own encrypted sync blob"
  ON public.encrypted_sync_blobs
  FOR DELETE
  USING (auth.uid() = user_id);
```

`encrypted_blob` 示例：

```json
{
  "version": 1,
  "algorithm": "AES-GCM",
  "iv": "base64-iv",
  "data": "base64-ciphertext"
}
```

明文 JSON 在加密前的结构：

```typescript
interface SyncPlaintext {
  version: 1;
  exportedAt: number;
  records: WatchRecord[];
  customSites: CustomSite[];
}
```

## 本地存储设计

### 推荐安全模式

默认不把明文 Data Key 持久化到 `chrome.storage.local`。

```text
用户打开浏览器或扩展
  -> 首次同步时输入同步加密密码
  -> 解密 Data Key
  -> Data Key 保存在内存
  -> 扩展重启后重新输入
```

优点：

- 本地 storage 泄露时不能直接解密云端密文
- 更接近端到端加密

缺点：

- 浏览器或扩展重启后需要重新输入同步加密密码

### 可选便捷模式

允许用户选择“记住此设备”。

```text
Data Key 明文或被本地设备密钥保护后保存到 chrome.storage.local
```

该模式用户体验更好，但隐私强度下降。界面上应明确说明：

```text
记住此设备后，本机可自动解密同步数据。请只在可信设备上启用。
```

## 前端模块设计

建议新增：

```text
src/shared/crypto.ts
src/shared/encryptedSync.ts
src/shared/keyManager.ts
```

### crypto.ts

负责底层密码学能力：

- `deriveKek(password, salt, iterations)`
- `generateDataKey()`
- `importAesKey(rawKey)`
- `exportAesKey(key)`
- `encryptJson(value, key)`
- `decryptJson(payload, key)`
- `encryptBytes(bytes, key)`
- `decryptBytes(payload, key)`
- `bytesToBase64(bytes)`
- `base64ToBytes(base64)`

必须使用浏览器 Web Crypto API：

- KDF: `PBKDF2`
- Hash: `SHA-256`
- Encryption: `AES-GCM`
- Data Key length: `256`
- IV length: `12 bytes`
- Salt length: `16 bytes`
- PBKDF2 iterations: 初始 `210000`，后续可随版本提高

### keyManager.ts

负责密钥生命周期：

- 初始化用户加密配置
- 下载 `user_encryption_keys`
- 根据用户输入密码派生 KEK
- 解密 Data Key
- 创建新的 Data Key
- 修改同步加密密码
- 清除内存中的 Data Key

内存中只保存当前会话需要的 `CryptoKey`，避免在日志、错误信息、Vue 状态和 DOM 中暴露密钥。

### encryptedSync.ts

负责加密同步流程：

- 构造 `SyncPlaintext`
- 使用 Data Key 加密业务数据
- 上传 `encrypted_sync_blobs`
- 下载 `encrypted_sync_blobs`
- 本地解密
- 本地合并数据
- 重新加密上传

## 首次启用流程

```text
1. 用户登录 Supabase
2. 用户在设置页启用加密云同步
3. 用户输入同步加密密码
4. 本地生成 256-bit Data Key
5. 本地生成 16-byte salt
6. 使用 PBKDF2 从同步加密密码派生 KEK
7. 使用 KEK 加密 Data Key
8. 上传 user_encryption_keys
9. 读取本地 WatchRecord[] 和 CustomSite[]
10. 使用 Data Key 加密 SyncPlaintext
11. 上传 encrypted_sync_blobs
12. 标记加密同步已启用
```

启用成功后，旧的明文 `records` 云同步表不再写入。

## 已启用设备同步流程

```text
1. 检查内存中是否有 Data Key
2. 如果没有，要求用户输入同步加密密码
3. 下载 user_encryption_keys
4. 使用密码 + salt 派生 KEK
5. 解密 encrypted_data_key 得到 Data Key
6. 下载 encrypted_sync_blobs
7. 使用 Data Key 解密云端数据
8. 读取本地数据
9. 本地合并
10. 使用 Data Key 重新加密合并结果
11. 上传 encrypted_sync_blobs
12. 保存合并后的本地数据
```

## 新设备恢复流程

```text
1. 用户在新设备登录 Supabase
2. 设置页检测到 user_encryption_keys 已存在
3. 提示用户输入同步加密密码
4. 使用云端 salt 派生 KEK
5. 解密 encrypted_data_key
6. 下载 encrypted_sync_blobs
7. 解密得到 WatchRecord[] 和 CustomSite[]
8. 写入本地 chrome.storage.local
```

如果密码错误，AES-GCM 解密会失败。提示文案：

```text
同步加密密码不正确，无法解密云端数据。
```

不要区分“密码错误”和“密文损坏”的详细原因，避免泄露额外信息。

## 修改同步加密密码

修改密码不需要重新加密所有观看记录。

```text
1. 用户输入旧同步加密密码
2. 下载 user_encryption_keys
3. 用旧密码派生 old KEK
4. 解密 encrypted_data_key 得到 Data Key
5. 用户输入新同步加密密码
6. 生成新的 salt
7. 用新密码派生 new KEK
8. 用 new KEK 加密同一个 Data Key
9. 更新 user_encryption_keys
```

`encrypted_sync_blobs` 不需要改动。

## 忘记同步加密密码

忘记同步加密密码后，云端密文无法恢复。可提供两个产品路径。

### 重置加密

```text
1. 用户确认忘记同步加密密码
2. 删除云端 user_encryption_keys
3. 删除云端 encrypted_sync_blobs
4. 重新生成 Data Key
5. 使用新同步加密密码初始化
6. 上传当前设备的本地数据
```

风险：

- 其他设备中只存在于云端、当前设备没有的数据会丢失

### 恢复码

首次启用时生成一组高强度恢复码。恢复码可以额外保护一份 Data Key：

```text
Data Key -- Recovery KEK 加密 --> encrypted_data_key_by_recovery_code
```

恢复码只展示一次，由用户保存。云端不保存恢复码明文。

恢复码是 P1 能力，P0 可先不实现。

## 本地合并策略

由于云端只保存密文，服务端不能按视频标题、URL、平台或时间做合并。

合并必须在本地完成：

```text
下载密文
  -> 本地解密
  -> 与本地 records 合并
  -> 本地重新加密
  -> 上传密文
```

观看记录合并可沿用当前逻辑：

- 以 `platform + url` 作为本地合并 key
- `lastWatchedAt` 更新的一方优先
- `currentTime`、`duration`、`progress` 使用较新的数据
- `createdAt` 取更早时间

注意：合并 key 只在本地使用，不上传云端明文。

## 数据迁移

### 从明文云同步迁移到加密云同步

```text
1. 用户升级插件
2. 设置页显示“启用加密云同步”
3. 用户设置同步加密密码
4. 从本地读取当前明文 records/customSites
5. 加密上传到 encrypted_sync_blobs
6. 停止写入旧 records/custom_sites 表
7. 可选：提示用户删除旧云端明文数据
```

删除旧明文数据建议由用户确认后执行：

```sql
DELETE FROM public.records WHERE user_id = auth.uid();
DELETE FROM public.custom_sites WHERE user_id = auth.uid();
```

### 本地明文存储迁移

P0 可以继续使用本地明文 `chrome.storage.local`，只保证云端密文。

P1 再支持本地加密存储：

```text
chrome.storage.local records
  -> encrypted_local_records
```

如果启用本地加密，需要考虑扩展启动后解锁体验。

## 错误处理

### 密码错误

```text
同步加密密码不正确，无法解密云端数据。
```

### 云端没有密钥配置

```text
当前账号尚未启用加密同步，请先在本设备初始化。
```

### 云端密文损坏

```text
云端同步数据无法解密。请检查同步加密密码，或使用当前设备数据重置云端同步。
```

### 版本不支持

```text
云端同步数据由更高版本创建，请升级插件后再同步。
```

## 安全要求

- 不记录同步加密密码、Data Key、KEK、明文数据到日志
- 不把同步加密密码放入 Vue 响应式全局状态
- 不把密钥放入 URL、DOM attribute、错误上报或 analytics
- 每次加密必须使用新的随机 IV
- AES-GCM IV 长度固定 12 bytes
- 同一个 Data Key 下不能重复使用相同 IV
- PBKDF2 salt 每个用户独立生成
- 密码输入框使用 `type="password"`
- 同步加密密码设置时要求二次确认
- 修改密码必须验证旧密码
- 退出登录时清除内存中的 Data Key

## 隐私边界

本方案可以防止：

- Supabase 表中直接出现观看记录明文
- 数据库泄露后直接读取用户观看历史
- 后台管理员通过普通查询查看用户视频标题和 URL

本方案不能防止：

- 用户设备已经被恶意软件控制
- 浏览器扩展运行时被恶意调试
- 用户输入同步加密密码时被系统级键盘记录
- 云端根据密文大小、更新时间推断粗略使用频率

## 实施阶段

### P0 云端加密同步

- 新增 `user_encryption_keys`
- 新增 `encrypted_sync_blobs`
- 新增 `crypto.ts`
- 新增 `keyManager.ts`
- 新增 `encryptedSync.ts`
- 设置页增加启用加密同步、输入同步加密密码、解锁同步
- 同步时上传密文 blob
- 停止写入旧明文 `records` 表

### P1 本地加密和恢复码

- 支持本地加密 `chrome.storage.local`
- 支持“记住此设备”
- 支持恢复码
- 支持修改同步加密密码
- 支持删除旧云端明文数据

### P2 分片同步和冲突优化

- 将完整 blob 拆分为记录级密文
- 云端只保存随机 `ciphertext_id`
- 本地维护加密索引
- 减少每次同步上传的数据量

## 推荐实现顺序

1. 新增 Supabase 加密同步表和 RLS 策略
2. 实现 `src/shared/crypto.ts` 并添加单元测试
3. 实现 Data Key 初始化和解锁流程
4. 实现 `SyncPlaintext` 的加密上传和下载解密
5. 在设置页增加加密同步入口
6. 将 `useSync` 切换到加密 blob 同步
7. 增加明文云数据迁移提示
8. 补充新设备恢复、密码错误、密文损坏测试

