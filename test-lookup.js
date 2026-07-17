import loader from "./data/loader.js";
import { lookupEntity } from "./controllers/apiController.js";

async function run() {
    await loader.loadAll();

    const testCases = [
        { type: "feat", name: "Alert", source: "PHB" },
        { type: "feat", name: "Alert", source: "XPHB" },
        { type: "spell", name: "Fireball", source: "PHB" },
        { type: "spell", name: "Fireball", source: "XPHB" },
    ];

    for (const tc of testCases) {
        const req = {
            query: tc
        };
        let statusVal = 200;
        let jsonVal = null;
        const res = {
            status: (code) => {
                statusVal = code;
                return res;
            },
            json: (data) => {
                jsonVal = data;
                return res;
            }
        };

        lookupEntity(req, res);
        console.log(`Lookup ${tc.type} "${tc.name}" (source: ${tc.source}) -> Status: ${statusVal}, Result: ${jsonVal ? (jsonVal.error || "Success: " + jsonVal.name + " (" + jsonVal.source + ")") : "null"}`);
    }
}
run();
