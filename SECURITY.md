# 班级空间访问控制

## 访问模型

- 未登录用户不会挂载业务模块，也不会订阅 Firestore 数据。
- 超级管理员必须用已验证的指定 Google 账号登录；浏览器缓存、用户资料中的角色字段和本地口令都不能授予管理员权限。
- 成员必须同时满足：Firebase Auth 登录成功、`users/{authUid}` 资料存在、`approved == true`、`disabled != true`。
- 新成员可以用学号和密码提交自助注册申请，但只能创建自己的 `member` 待审资料（`approved == false`）。
- 待审账号不能读取班级集合、不能自行批准或提升角色；超级管理员可在“管理后台 → 待审批注册申请”中批准或拒绝。
- 超级管理员仍可在“管理后台 → 开通成员账号”中直接创建并批准账号。
- 旧账号需要超级管理员核对 Auth UID 后批准；没有 Auth UID 的旧记录需要重新开通账号。
- 超级管理员可读取所有集合，并可在管理后台查看最近 200 条私聊用于调试。普通成员只能读取自己参与的新私聊。

## 发布 Firestore 规则

Cloudflare 的前端自动部署不会替你发布 Firebase 安全规则。首次启用以及以后修改 `firestore.rules` 后，需要由 Firebase 项目管理员执行：

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore
```

项目和命名数据库已经写入 `.firebaserc` 与 `firebase.json`。发布完成前，线上 Firestore 仍使用旧规则，不能视为已完成访问隔离。

## 管理员上线检查

1. 用指定 Google 账号进入网页。
2. 打开“管理后台”，检查成员姓名、学号、邮箱和 Auth UID。
3. 只批准确认属于本班同学的注册申请和旧账号。
4. 对不认识的账号保持未批准或撤销访问。
