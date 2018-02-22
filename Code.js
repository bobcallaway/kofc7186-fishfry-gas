function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Station Menu')
      .addItem('Labelling Station', 'showSidebar')
      .addItem('Ready Station', 'showSidebar')
      .addItem('Closing Station', 'showSidebar')
      .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('page')
      .setTitle('My custom sidebar')
      .setWidth(300);
  SpreadsheetApp.getUi() // Or DocumentApp or FormApp.
      .showSidebar(html);
}

/**
 * Retrieves order information from the Square V1 Payment API.
 * 
 * Assumes SQUARE_ACCESS_TOKEN for authentication is stored in Script Property of same name
 *
 * @param {string} locationId
 *   Location ID corresponding to Square Location
 * @param {string} orderId
 *   Order ID corresponding to Square Payment object
 * @returns {object} payment object from Square V1 API 
 *   https://docs.connect.squareup.com/api/connect/v1#datatype-payment
 * @throws Will throw an error if the API call to Square is not successful for any reason
 */
function fetchOrderDetails(locationId, orderId){
  var params = {
    headers: {
      "Authorization": "Bearer " + PropertiesService.getScriptProperties().getProperty("SQUARE_ACCESS_TOKEN")
    },
  };
  
  var url = "https://connect.squareup.com/v1/" + locationId + "/payments/" + orderId;
  var response = UrlFetchApp.fetch(url, params);
  
  return JSON.parse(response.getContentText());  
}

/**
 * Retrieves the origin of a given order from the Square V2 Transactions API.
 * 
 * Assumes SQUARE_ACCESS_TOKEN for authentication is stored in Script Property of same name
 *
 * @param {string} locationId
 *   Location ID corresponding to Square Location
 * @param {string} orderId
 *   Order ID corresponding to Square Payment object
 * @param {string} created_at
 *   date when the order was created in RFC3339 format (e.g. 2016-01-15T00:00:00Z)
 * @returns {object} payment object from Square V1 API 
 *   https://docs.connect.squareup.com/api/connect/v1#datatype-payment
 * @throws Will throw an error if the transaction can not be found or
 *         if the API call to Square is not successful for any reason
 */
function fetchOrderOrigin(locationId, orderId, created_at){
  var params = {
    headers: {
      "Authorization": "Bearer " + PropertiesService.getScriptProperties().getProperty("SQUARE_ACCESS_TOKEN")
    },
  };
  
  // when sort_order parameter is ASC, the results will be inclusive of the record we're looking for.
  var url = "https://connect.squareup.com/v2/locations/" + locationId + "/transactions?begin_time=" + created_at + "&sort_order=ASC";
  
  var response = UrlFetchApp.fetch(url, params);
  var responseObj = JSON.parse(response.getContentText());
  
  // the Square V1 API returns the payment information; 
  // the Square V2 API nests this data underneath a transaction object
  var origin = "";
  var customer_id = "";
  
  // because we're searching on a time-based window, the call may return up to 50 transactions (via pagination).
  // we safely? assume that our transactional load is so low that we do not receive more than 50 transactions within the same second.
  // the following for-each loop finds the appropriate transaction object that corresponds to the payment ID (aka tender.id)
  for each (var txn in responseObj.transactions) {
    for each (var tender in txn.tenders){
      if (tender.id == orderId) {
        origin = txn.product; //REGISTER or ONLINE_STORE or EXTERNAL_API
        customer_id = tender.customer_id; //we store this to query the customer's last name
        break;
      }  
    }
    if (origin != "")
      break;
  }
  
  if (origin == "")  
    throw "Transaction " + orderId + " not found in fetchOrderOrigin!";
  
  return {origin: origin};//, customer_name: fetchCustomerFamilyName(customer_id)};
}

/**
 * Retrieves the customer's last name (aka family name) for a specified customer record
 * 
 * Assumes SQUARE_ACCESS_TOKEN for authentication is stored in Script Property of same name
 * Uses Square Connect V2 API as the V1 API does not expose customer objects
 *
 * @param {string} customerId
 *   Customer ID corresponding to Square Customer Object
 * @returns {string} customer's last name
 * @throws Will throw an error if the API call to Square is not successful for any reason (including customer_id not found)
 */
function fetchCustomerFamilyName(customer_id) {
  var params = {
    headers: {
      "Authorization": "Bearer " + PropertiesService.getScriptProperties().getProperty("SQUARE_ACCESS_TOKEN")
    },
  };
  
  var url = "https://connect.squareup.com/v2/customers/" + customer_id;
  
  var response = UrlFetchApp.fetch(url, params);
  var responseObj = JSON.parse(response.getContentText());
  
  return responseObj.customer.family_name;
}

/**
 * Retrieves the appropriate order state based on where an order was received
 * 
 * @param {string} origin
 *   Square product that processed order
 * @returns {string} appropriate state
 * @throws Will throw an error if Square product string is unknown
 */
function getStateFromOrigin(origin){
  switch (origin) {
    case "REGISTER":
      return "Present";
      break;
    case "ONLINE_STORE":
      return "Paid Online";
      break;
    default:
      throw "Unknown origin (" + origin + ") of transaction!";
  }
}

function bob(){
  // these values come from webhook inbound to doPost method
  var obj = fetchOrderDetails("62RAE2R9VQP18","au3jeZNqZNehUafSL124KQB");
  
  Logger.log(obj.created_at);
  var origin = fetchOrderOrigin("62RAE2R9VQP18","au3jeZNqZNehUafSL124KQB", obj.created_at);
  
  Logger.log(obj.id);
  Logger.log(obj.receipt_url);
  for each (var item in obj.itemizations) {
    Logger.log("(" + parseInt(item.quantity) + ") " + item.name + " (" + item.item_variation_name + ")");
    for each (var modifier in item.modifiers) {
      Logger.log("   Side: " + modifier.name);
    }
  }
  
  //create labels from obj
  
  var result = {
    orderNumber: obj.id,
    orderDate: obj.created_at,
    orderState: getStateFromOrigin(origin.origin),
  };
  
  if (result.orderState == "Present")
    result.timePresent = (new Date()).toISOString(); //TODO:fix this
  
  Logger.log(result);
}