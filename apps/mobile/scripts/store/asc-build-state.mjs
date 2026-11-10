// 읽기만: 빌드 처리 상태. node asc-build-state.mjs <빌드 번호>
import { asc, APP_ID } from "./stores.mjs";
const [build] = process.argv.slice(2);
const r = await asc("GET", `/v1/builds?filter[app]=${APP_ID}&filter[version]=${build}&fields[builds]=version,processingState,uploadedDate&limit=5`);
console.log(r.data.map((b) => `${b.id} build ${b.attributes.version} ${b.attributes.processingState} ${b.attributes.uploadedDate}`));
