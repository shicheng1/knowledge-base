import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';

const HOST_NAME = 'com.knowledgebase.host';
const TARGET_DIR = path.join(process.env.LOCALAPPDATA || '', 'KnowledgeBase');

export function isNativeMessagingRegistered(): boolean {
  try {
    const regKey = `HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
    const result = execSync(`reg query "${regKey}" /ve`, { encoding: 'utf-8' });
    return result.includes(HOST_NAME);
  } catch {
    return false;
  }
}

export function registerNativeMessaging(extensionId: string): { success: boolean; error?: string } {
  try {
    if (!extensionId || extensionId.trim().length === 0) {
      return { success: false, error: '请输入 Chrome 扩展 ID' };
    }

    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    const exePath = app.getPath('exe');
    const hostBatPath = path.join(TARGET_DIR, 'host.bat');
    const hostJsonPath = path.join(TARGET_DIR, `${HOST_NAME}.json`);

    fs.writeFileSync(hostBatPath, `@echo off\n"${exePath}" --native-messaging-host\n`, 'utf-8');
    logger.info(`生成 host.bat: ${hostBatPath}`);

    const hostJson = {
      name: HOST_NAME,
      description: '知识库桌面应用 Native Messaging Host',
      path: hostBatPath,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${extensionId.trim()}/`],
    };
    fs.writeFileSync(hostJsonPath, JSON.stringify(hostJson, null, 2), 'utf-8');
    logger.info(`生成 host.json: ${hostJsonPath}`);

    const regKey = `HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${hostJsonPath}" /f`, { encoding: 'utf-8' });
    logger.info(`注册表写入成功: ${regKey}`);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('注册 Native Messaging 失败:', error);
    return { success: false, error: msg };
  }
}

export function unregisterNativeMessaging(): { success: boolean; error?: string } {
  try {
    const regKey = `HKCU\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
    execSync(`reg delete "${regKey}" /f`, { encoding: 'utf-8' });
    logger.info(`注册表删除成功: ${regKey}`);

    const hostBatPath = path.join(TARGET_DIR, 'host.bat');
    const hostJsonPath = path.join(TARGET_DIR, `${HOST_NAME}.json`);

    if (fs.existsSync(hostBatPath)) fs.unlinkSync(hostBatPath);
    if (fs.existsSync(hostJsonPath)) fs.unlinkSync(hostJsonPath);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('取消注册 Native Messaging 失败:', error);
    return { success: false, error: msg };
  }
}

export function isContextMenuRegistered(): boolean {
  try {
    const result = execSync(
      `reg query "HKCU\\Software\\Classes\\*\\shell\\SaveToKnowledgeBase" /ve`,
      { encoding: 'utf-8' },
    );
    return result.includes('SaveToKnowledgeBase');
  } catch {
    return false;
  }
}

export function registerContextMenu(): { success: boolean; error?: string } {
  try {
    const exePath = app.getPath('exe');

    execSync(
      `reg add "HKCU\\Software\\Classes\\*\\shell\\SaveToKnowledgeBase" /ve /d "保存到知识库" /f`,
      { encoding: 'utf-8' },
    );
    execSync(
      `reg add "HKCU\\Software\\Classes\\*\\shell\\SaveToKnowledgeBase" /v "Icon" /d "${exePath}" /f`,
      { encoding: 'utf-8' },
    );
    execSync(
      `reg add "HKCU\\Software\\Classes\\*\\shell\\SaveToKnowledgeBase\\command" /ve /d "\\"${exePath}\\" --save-file \\"%1\\"" /f`,
      { encoding: 'utf-8' },
    );

    logger.info('Windows 右键菜单注册成功');
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('注册右键菜单失败:', error);
    return { success: false, error: msg };
  }
}

export function unregisterContextMenu(): { success: boolean; error?: string } {
  try {
    execSync(`reg delete "HKCU\\Software\\Classes\\*\\shell\\SaveToKnowledgeBase" /f`, {
      encoding: 'utf-8',
    });
    logger.info('Windows 右键菜单取消注册成功');
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('取消注册右键菜单失败:', error);
    return { success: false, error: msg };
  }
}
