/**

This script processes the webhook request from the Square Connect V1 API which
indicates that an order has been created or updated. We use the information
passed in the webhook request to query the Square Connect API for additional
order information (meals, sides, quantities, etc).

**/
function doPost(e) {
  
  /*
  NOTE: Google Apps Script will not show us POST headers, so we'll have to trust that 
  the input is valid from the webhook... normally we should be doing an HMAC-SHA1 on
  a request header, but since GAS won't show us the value we can't validate it.
  
  We are expecting data in payload that looks like this:
  {
    "merchant_id": "18YC4JBH91E1H",
    "location_id": "JGHJ0343",
    "event_type": "PAYMENT_UPDATED",
    "entity_id": "Jq74mCczmFXk1tC10GB"
  }
  */
  
  if (e.hasOwnProperty('postData') && e.postData.type !== "application/json") {
    throw "Invalid Input Type!"
  }
  
  var input = JSON.parse(e.postData.contents);
  
  // PAYMENT_UPDATED will be sent regardless of creation or update
  if (input.event_type == 'PAYMENT_UPDATED'){
    //var orderDetails = fetchOrderDetails(input.merchant_id, input.location_id, input.entity_id);
    
    //determine correct state? 
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master").appendRow(["post2",JSON.stringify(e)]);

    //find in sheet, upsert?
  }
  else {
    //TODO: delete this
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master").appendRow(["post",input.event_type]);
  }
  
  // return an HTTP 200 OK with no content for webhook request
  return HtmlService.createHtmlOutput("");
}
