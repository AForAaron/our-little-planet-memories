import path from "node:path";

function requiredAbsoluteRoot(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `缺少环境变量 ${name}。审核台不会读取源码目录中的私密数据。`,
    );
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`${name} 必须是绝对路径。`);
  }
  return path.resolve(value);
}

export function getImportRoots() {
  return {
    dataRoot: requiredAbsoluteRoot("IMPORT_DATA_ROOT"),
    workRoot: requiredAbsoluteRoot("IMPORT_WORK_ROOT"),
    publishRoot: requiredAbsoluteRoot("IMPORT_PUBLISH_ROOT"),
  };
}
