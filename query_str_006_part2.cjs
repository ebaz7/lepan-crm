const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `SELECT Field_001, Field_004, Field_011 FROM STR_TBL_006 WHERE Field_001 NOT IN ('64', '2', '3', '4', '5', '6', '59', '62', '51', '45', '48', '49', '52', '53', '60', '61', '7', '8', '63', '17', '18', '19', '20', '22', '57', '1', '34', '38', '13', '14', '15', '16', '21', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '65', '66', '67', '68', '69')`
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("More Doc Types:");
        res.data.data.forEach(r => console.log(r.Field_001, r.Field_004, r.Field_011));
    } catch(e) { console.error(e.response ? e.response.data : e.message); }
}
run();
