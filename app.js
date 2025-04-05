// Copyright (c) 2025 Brian Kircher
//
// Open Source Software: you can modify and/or share it under the terms of the
// BSD license file in the root directory of this project.

/**
 * The local storage object.
 */
const storage = window.localStorage;

/**
 * The idb object for accessing IndexedDB.
 */
let db = null;

/**
 * Indicates when a panel animation is active; used to keep a second one from
 * starting while the first is active.
 */
let animationActive = false;

/**
 * The stack of panels that are open.
 */
let panelStack = [];

/**
 * The stack of dialogs that are open.
 */
let dialogStack = [];

/**
 * The panel for the main application display.
 */
let mainPanel = null;

/**
 * The panel for adding or editing a car.
 */
let carAddEditPanel = null;

/**
 * The panel for displaying the details of a car.
 */
let carPanel = null;

/**
 * The panel for adding or editing a fuel record.
 */
let fuelAddEditPanel = null;

/**
 * The about dialog.
 */
let aboutDialog = null;

/**
 * The drawdown license dialog.
 */
let drawdownDialog = null;

/**
 * The Font Awesome 4.7 license dialog.
 */
let fontawesomeDialog = null;

/**
 * The idb license dialog.
 */
let idbDialog = null;

/**
 * The JQuery license dialog.
 */
let jqueryDialog = null;

/**
 * The application license dialog.
 */
let licenseDialog = null;

/**
 * The Plotly license dialog.
 */
let plotlyDialog = null;

/**
 * The confirmation dialog.
 */
let dialogConfirm = null;

/**
 * The alert dialog.
 */
let dialogAlert = null;

// Adapted from ios-pwa-splash <https://github.com/avadhesh18/iosPWASplash>
function
iosPWASplash(icon, color = "white")
{
  // Check if the provided 'icon' is a valid URL
  if((typeof icon !== "string") || (icon.length === 0))
  {
    throw new Error("Invalid icon URL provided");
  }

  // Calculate the device's width and height
  const deviceWidth = screen.width;
  const deviceHeight = screen.height;

  // Calculate the pixel ratio
  const pixelRatio = window.devicePixelRatio || 1;

  // Create two canvases and get their contexts to draw landscape and portrait
  // splash screens.
  const canvas = document.createElement("canvas");
  const canvas2 = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const ctx2 = canvas2.getContext("2d");

  // Create an image element for the icon
  const iconImage = new Image();

  iconImage.onerror = function ()
  {
    throw new Error("Failed to load icon image");
  };

  iconImage.src = icon;

  // Load the icon image.
  iconImage.onload = function ()
  {
    // Calculate the icon size based on the device's screen size.
    const min = Math.min(deviceWidth, deviceHeight) * pixelRatio;
    const iconSizew = (min * 3) / 5;
    const iconSizeh = (min * 3) / 5;

    canvas.width = deviceWidth * pixelRatio;
    canvas2.height = canvas.width;
    canvas.height = deviceHeight * pixelRatio;
    canvas2.width = canvas.height;
    ctx.fillStyle = color;
    ctx2.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

    // Calculate the position to center the icon
    const x = (canvas.width - iconSizew) / 2;
    const y = (canvas.height - iconSizeh) / 2;
    const x2 = (canvas2.width - iconSizew) / 2;
    const y2 = (canvas2.height - iconSizeh) / 2;

    // Draw the icon with the calculated size
    ctx.drawImage(iconImage, x, y, iconSizew, iconSizeh);
    ctx2.drawImage(iconImage, x2, y2, iconSizew, iconSizeh);
    const imageDataURL = canvas.toDataURL("image/png");
    const imageDataURL2 = canvas2.toDataURL("image/png");

    // Create the first startup image <link> tag (splash screen)
    const link = document.createElement("link");
    link.setAttribute("rel", "apple-touch-startup-image");
    link.setAttribute("media", "screen and (orientation: portrait)");
    link.setAttribute("href", imageDataURL);
    document.head.appendChild(link);

    // Create the second startup image <link> tag (splash screen)
    const link2 = document.createElement("link");
    link2.setAttribute("rel", "apple-touch-startup-image");
    link2.setAttribute("media", "screen and (orientation: landscape)");
    link2.setAttribute("href", imageDataURL2);
    document.head.appendChild(link2);
  };
}

// Generate iOS splash screens from the favicon.
iosPWASplash("favicon.webp", "#000000");

// Extend JQuery by adding a showModal() method (mimic-ing the corresponding
// method in the standard DOM model).
$.fn.extend({showModal: function()
                        {
                          return this.each(function()
                                           {
                                             if(this.tagName === "DIALOG")
                                             {
                                               this.showModal();
                                             }
                                           });
                        }
            });

// Extend JQuery by adding a close() method (mimic-ing the corresponding method
// in the standard DOM model).
$.fn.extend({close: function()
                    {
                      return this.each(function()
                                       {
                                         if(this.tagName === "DIALOG")
                                         {
                                           this.close();
                                         }
                                       });
                    }
            });

/**
 * Establishes the connection to IndexedDB.
 */
async function
dbOpen()
{
  // Open the database.
  db = await idb.openDB("fuelTracker", 1,
  {
    // Called if the existing version of the database is not the same as the
    // requested version.  For now, this happens only when the app is run for
    // the first time, and the database doesn't exist.
    upgrade(db, oldVersion, newVersion)
    {
      // See if the current (old) version is 0, meaning that the database
      // doesn't exist.
      if(oldVersion === 0)
      {
        // The options for the two object stores.
        let options =
        {
          keyPath: "id",
          autoIncrement: true
        };

        // Create the object store to track the cars.
        db.createObjectStore("cars", options);

        // Create the object store to track the fill-ups, with an alternate
        // index for accessing them by a particular car.
        let fuel = db.createObjectStore("fuel", options);
        fuel.createIndex("car", "car");
      }
    }
  });
}

/**
 * Enumerates the cars in the object store.
 *
 * @param {Array<Integer>} carIds The array into which to store the record IDs.
 *
 * @param {Array<Integer>} years The array into which to store the model years.
 *
 * @param {Array<String>} makes The array into which to store the makes.
 *
 * @param {Array<String>} models The array into which to store the models.
 *
 * @param {Array<String>} purchases The array into which to store the purchase
 *                                  dates.
 *
 * @param {Array<Integer>} mileages The array into which to store the purchase
 *                                  mileage.
 */
async function
dbCarsEnumerate(carIds = null, years = null, makes = null, models = null,
                purchases = null, mileages = null)
{
  // Create a cursor to index through the cars object store.
  let cursor = await db.transaction("cars").store.openCursor();

  // Loop while there are more entries in the object store.
  while(cursor)
  {
    // Save the details for this car.
    if(carIds !== null)
    {
      carIds.push(cursor.key);
    }
    if(years !== null)
    {
      years.push(cursor.value.year);
    }
    if(makes !== null)
    {
      makes.push(cursor.value.make);
    }
    if(models !== null)
    {
      models.push(cursor.value.model);
    }
    if(purchases !== null)
    {
      purchases.push(cursor.value.purchase);
    }
    if(mileages !== null)
    {
      mileages.push(cursor.value.mileage);
    }

    // Advance the cursor.
    cursor = await cursor.continue();
  }
}

/**
 * Adds a car to the object store.
 *
 * @param {integer} year The model year of the car.
 *
 * @param {string} make The make (manufacturer) of the car.
 *
 * @param {string} model The model name of the car.
 *
 * @param {string} purchase The purchase date of the dar.
 *
 * @param {integer} mileage The mileage of the car at the time of purchase.
 *
 * @returns The ID of the record added to the cars object store.
 */
async function
dbCarAdd(year, make, model, purchase, mileage)
{
  // Package the details of the car into a structure.
  const value =
  {
    year: year,
    make: make,
    model: model,
    purchase: purchase,
    mileage: mileage
  };

  // Add this car's information to the object store and return the record ID.
  return(await db.add("cars", value));
}

/**
 * Updates a car in the object store.
 *
 * @param {integer} carId The ID of the car to update.
 *
 * @param {integer} year The model year of the car.
 *
 * @param {string} make The make (manufacturer) of the car.
 *
 * @param {string} model The model name of the car.
 *
 * @param {string} purchase The purchase date of the dar.
 *
 * @param {integer} mileage The mileage of the car at the time of purchase.
 */
async function
dbCarUpdate(carId, year, make, model, purchase, mileage)
{
  // Package the details of the car into a structure.
  const value =
  {
    year: parseInt(year),
    make: make,
    model: model,
    purchase: purchase,
    mileage: parseInt(mileage),
    id: carId
  };

  // Update this car's information to the object store.
  await db.put("cars", value);
}

/**
 * Deletes a car from the cars object store.
 *
 * @param {integer} carId The ID of the car's record in the object store.
 */
async function
dbCarDelete(carId)
{
  // Get all the fill-up records for this car.
  let fuelIds = [];
  await dbFuelEnumerate(carId, fuelIds);

  // Delete all the fill-up records for this car.
  for(let idx = 0; idx < fuelIds.length; idx++)
  {
    await dbFuelDelete(fuelIds[idx]);
  }

  // Delete this record from the cars object store.
  await db.delete("cars", carId);
}

/**
 * Enumerates the fuel record of a car in the object store.
 *
 * @param {integer} carId The record ID of the car.
 *
 * @param {Array<Integer>} fuelIds The array into which to store the record
 *                                 IDs.
 *
 * @param {Array<String>} dates The array into which to store the dates.
 *
 * @param {Array<Integer>} mileages The array into which to store the mileages.
 *
 * @param {Array<Float>} prices The array into which to store the price/units.
 *
 * @param {Array<Float>} quantities The array into which to store the
 *                                  quantities.
 *
 * @param {Array(Float>)} total The array into which to store the total prices.
 *
 * @param {Array<Boolean>} partials The array into which to store the partial
 *                                 fillup indicators.
 *
 * @param {Array<Boolean>} misses The array into which to store the missed
 *                                fillup indicators.
 */
async function
dbFuelEnumerate(carId, fuelIds = null, dates = null, mileages = null,
                prices = null, quantities = null, totals = null,
                partials = null, misses = null)
{
  // Create a cursor to index through the fuel object store by car ID.
  let index = await db.transaction("fuel").store.index("car");

  // Loop through the fill-up records of this car.
  for await (const cursor of index.iterate(carId))
  {
    // Add the data for this fill-up record to the fill-up arrays.
    if(fuelIds !== null)
    {
      fuelIds.push(cursor.value.id);
    }
    if(dates !== null)
    {
      dates.push(cursor.value.date);
    }
    if(mileages !== null)
    {
      mileages.push(cursor.value.mileage);
    }
    if(prices !== null)
    {
      prices.push(cursor.value.price);
    }
    if(quantities !== null)
    {
      quantities.push(cursor.value.quantity);
    }
    if(totals !== null)
    {
      totals.push(cursor.value.total);
    }
    if(partials !== null)
    {
      partials.push(cursor.value.partial);
    }
    if(misses !== null)
    {
      misses.push(cursor.value.missed);
    }
  }
}

/**
 * Adds a fill-up record to the object store.
 *
 * @param {integer} carId The ID of the car.
 *
 * @param {string} date The date of the fill-up.
 *
 * @param {integer} mileage The car's mileage at the time of the fill-up.
 *
 * @param {double} price The price of a unit of fuel.
 *
 * @param {double} quantity The number of units of fuel.
 *
 * @param {double} total The total cost of the fill-up (price * quantity).
 *
 * @param {boolean} partial True if this fill-up did not completely fill the
 *                          fuel tank (meaning it can't be compared to the
 *                          previous fill-up from a statistical perspective).
 *
 * @param {boolean} missed True if this fill-up happend after another fill-up
 *                         that was not recorded (also meaning it can't be
 *                         compared to the previous fill-up, which doesn't
 *                         exist).
 *
 * @returns The ID of the record added to the fuel object store.
 */
async function
dbFuelAdd(carId, date, mileage, price, quantity, total, partial, missed)
{
  // Package the details of the fill-up into a structure.
  const value =
  {
    car: carId,
    date: date,
    mileage: mileage,
    price: price,
    quantity: quantity,
    total: total,
    partial: partial,
    missed: missed
  };

  // Add this fill-up's information to the object store and return the record
  // ID.
  return(await db.add("fuel", value));
}

/**
 * Updates a fill-up record in the object store.
 *
 * @param {integer} fuelId The ID of the fill-up to update.
 *
 * @param {integer} carId The ID of the car.
 *
 * @param {string} date The date of the fill-up.
 *
 * @param {integer} mileage The car's mileage at the time of the fill-up.
 *
 * @param {double} price The price of a unit of fuel.
 *
 * @param {double} quantity The number of units of fuel.
 *
 * @param {double} total The total cost of the fill-up (price * quantity).
 *
 * @param {boolean} partial True if this fill-up did not completely fill the
 *                          fuel tank (meaning it can't be compared to the
 *                          previous fill-up from a statistical perspective).
 *
 * @param {boolean} missed True if this fill-up happend after another fill-up
 *                         that was not recorded (also meaning it can't be
 *                         compared to the previous fill-up, which doesn't
 *                         exist).
 *
 * @returns The ID of the record added to the fuel object store.
 */
async function
dbFuelUpdate(fuelId, carId, date, mileage, price, quantity, total, partial,
             missed)
{
  // Package the details of the fill-up into a structure.
  const value =
  {
    car: carId,
    date: date,
    mileage: mileage,
    price: price,
    quantity: quantity,
    total: total,
    partial: partial,
    missed: missed,
    id: fuelId
  };

  // Update this fill-up's information to the object store.
  return(await db.put("fuel", value));
}

/**
 * Deletes a fill-up from the fuel object store.
 *
 * @param {integer} fuelId The ID of the fill-up's record in the object store.
 */
async function
dbFuelDelete(fuelId)
{
  // Delete this record from the fuel object store.
  await db.delete("fuel", fuelId);
}

/**
 * Creates an HTML fragment to show a FontAwesome icon.
 *
 * @param {string} icon The name of the icon (excluding the "fa-" prefix).
 *
 * @returns An HTML fragment to show the icon.
 */
function
fa(icon)
{
  return(`<span class="fa fa-${icon}"></span>`);
}

/**
 * A top-level panel.
 */
class Panel
{
  /**
   * Builds the panel and adds it to the DOM.  By default, it is hidden.
   *
   * @param {string} _class The optional class to add to the panel.
   */
  constructor(_class = "")
  {
    if(_class !== "")
    {
      _class = ` ${_class}`;
    }

    // The HTML for the panel.
    const html = `<div class="panel${_class}">` +
                 `  <div class="container">` +
                 `    <div class="header"></div>` +
                 `    <div class="body"></div>` +
                 `    <div class="footer"></div>` +
                 `  </div>` +
                 `</div>`;

    // Add this panel to the DOM.
    $("body").append(html);

    // Save the relevant panel member variables for later use.
    this.panel = $("body").children().last();
    this.header = this.panel.find(".header");
    this.body = this.panel.find(".body");
    this.footer = this.panel.find(".footer");
  }

  /**
   * Shows the panel.
   */
  show()
  {
    this.panel.show();
  }

  /**
   * Hides the panel.
   */
  hide()
  {
    this.panel.hide();
  }

  /**
   * Adds a class to the panel.
   *
   * @param {string} name The name of the class to add.
   */
  addClass(name)
  {
    this.panel.addClass(name);
  }

  /**
   * Removes a class from the panel.
   *
   * @param {string} name The name of the class to remove.
   */
  removeClass(name)
  {
    this.panel.removeClass(name);
  }

  /**
   * Adds an event handler to the panel.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.panel.on(event, fn);
  }

  /**
   * Removes an event handler from the panel.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.panel.off(event);
  }

  /**
   * Sets the z-index of the panel.
   *
   * @param {integer} index The value for the z-index; larger values are closer
   *                        to the viewer.
   */
  zIndex(index)
  {
    this.panel.css("z-index", index);
  }
}

/**
 * A link.
 */
class Link
{
  /**
   * Builds the span and adds it to the DOM.
   *
   * @param {Object} parent The parent for the span.
   *
   * @param {string} label The text to appear inside the link.
   *
   * @param {string} link The optionsal target for the link.
   */
  constructor(parent, label, link = "")
  {
    // Convert the link into an HTML attribute.
    if(link !== "")
    {
      link = ` href="${link}" target="_blank"`;
    }

    // The HTML for the link.
    const html = `<a${link}>${label}</link>`;

    // Add the link to the parent.
    parent.append(html);

    // Save the relevant link member variables for later use.
    this.link = parent.children().last();
  }

  /**
   * Adds an event handler to the link.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.link.on(event, fn);
  }

  /**
   * Removes an event handler from the link.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.link.off(event);
  }
}

/**
 * A span, which may contain text.
 */
class Span
{
  /**
   * Builds the span and adds it to the DOM.
   *
   * @param {Object} parent The parent for the span.
   *
   * @param {string} label The optional text to appear inside the span.
   *
   * @param {string} _class The optional class to apply to the span.
   */
  constructor(parent, label = "", _class = "")
  {
    // Convert the class into an HTML attribute.
    if(_class !== "")
    {
      _class = ` class="${_class}"`;
    }

    // The HTML for the span.
    const html = `<span${_class}>${label}</span>`;

    // Add the span to the parent.
    parent.append(html);

    // Save the relevant span member variables for later use.
    this.span = parent.children().last();
  }

  /**
   * Reads or updates the HTML content of the span.
   *
   * @param {string} string The new HTML content.
   *
   * @return Returns the HTML content if <code>string</code> is undefined.
   */
  html(string = undefined)
  {
    if(string === undefined)
    {
      return(this.span.html());
    }
    else
    {
      this.span.html(string);
    }
  }

  /**
   * Reads or updates the text content of the span.
   *
   * @param {string} string The new text content.
   *
   * @return Returns the text content if <code>string</code> is undefined.
   */
  text(string = undefined)
  {
    if(string === undefined)
    {
      return(this.span.text());
    }
    else
    {
      this.span.text(string);
    }
  }

  /**
   * Adds an event handler to the button.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.span.on(event, fn);
  }

  /**
   * Removes an event handler from the button.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.span.off(event);
  }
}

/**
 * A button.
 */
class Button
{
  /**
   * Builds the button and adds it to the DOM.
   *
   * @param {Object} parent The parent for the button.
   *
   * @param {string} label The optional text to appear in the button.
   */
  constructor(parent, label = "")
  {
    // If the button has no label, set its class to empty (so that it takes up
    // space but isn't usable).
    const _class = (label === "") ? ` class="empty"` : "";

    // The HTML for the button.
    const html = `<button${_class}>${label}</button>`;

    // Add the button to the parent.
    parent.append(html);

    // Save the relevant button member variables for later use.
    this.button = parent.children().last();
  }

  /**
   * Shows the button.
   */
  show()
  {
    this.button.show();
  }

  /**
   * Hides the button.
   */
  hide()
  {
    this.button.hide();
  }

  /**
   * Adds a class to the button.
   *
   * @param {string} name The name of the class to add.
   */
  addClass(name)
  {
    this.button.addClass(name);
  }

  /**
   * Removes a class from the button.
   *
   * @param {string} name The name of the class to remove.
   */
  removeClass(name)
  {
    this.button.removeClass(name);
  }

  /**
   * Adds an event handler to the button.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.button.on(event, fn);
  }

  /**
   * Removes an event handler from the button.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.button.off(event);
  }

  html(str)
  {
    this.button.html(str);
  }
}

/**
 * An input.
 */
class Input
{
  /**
   * Builds the input and adds it to the DOM.
   *
   * @param {Object} parent The parent for the input.
   *
   * @param {string} type The optional type for the input; defaults to a text
   *                      input.
   *
   * @param {string} placeholder The optional placeholder text to display if
   *                             the input field is empty.
   */
  constructor(parent, type = "text", placeholder = "")
  {
    let value = "";

    if(placeholder !== "")
    {
      placeholder = ` placeholder="${placeholder}"`;
    }

    // The HTML for the input.
    const html = `<input type="${type}"${placeholder}>${value}</input>`;

    // Add the input to the parent.
    parent.append(html);

    // Save the relevant input member variables for later use.
    this.input = parent.children().last();
  }

  /**
   * Adds an event handler to the input.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.input.on(event, fn);
  }

  /**
   * Removes an event handler from the input.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.input.off(event);
  }

  /**
   * Gets or sets the value of the input.
   *
   * @param {string} value The optional new value for the input.
   *
   * @returns The value of the input.
   */
  val(value = undefined)
  {
    if(value === undefined)
    {
      return(this.input.val());
    }
    else
    {
      this.input.val(value);
    }
  }
}

/**
 * A toggle input.
 */
class Toggle
{
  /**
   * Build the toggle input and adds it to the DOM.
   *
   * @param {Object} parent The parent for the toggle.
   *
   * @param {string} text The text describing the toggle
   *
   * @param {Array<string>} values The values for the toggle, with the first
   *                               item being displayed when the toggle is not
   *                               selected and the second item being displayed
   *                               when the toggle is selected.
   */
  constructor(parent, text, values = [ "no", "yes" ])
  {
    // The HTML for the toggle input.
    const html = `<label class="toggle flex-row">` +
                 `  <span class="label">${text}</span>` +
                 `  <input type="checkbox" role="switch">` +
                 `  <span class="state">` +
                 `    <span class="container">` +
                 `      <span class="position"></span>` +
                 `    </span>` +
                 `    <span class="text">` +
                 `      <span class="off" aria-hidden="true">${values[0]}</span>` +
                 `      <span class="on" aria-hidden="true">${values[1]}</span>` +
                 `    </span>` +
                 `  </span>` +
                 `</label>`;

    // Add the toggle to the parent.
    parent.append(html);

    // Save the relevant toggle member variables for later use.
    this.toggle = parent.children().last();
    this.input = this.toggle.find("input[type=checkbox][role^=switch]");
  }

  /**
   * Adds an event handler to the input.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.input.on(event, fn);
  }

  /**
   * Removes an event handler from the input.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.input.off(event);
  }

  /**
   * Gets or sets the value of the toggle.
   *
   * @param {boolean} value The optional new value for the toggle.
   *
   * @returns The value of the toggle.
   */
  val(value = undefined)
  {
    if(value === undefined)
    {
      return(this.input.is(":checked"));
    }
    else
    {
      this.input.prop("checked", value);
    }
  }
}

/**
 * An image.
 */
class Img
{
  /**
   * Builds the image and adds it to the DOM.
   *
   * @param {Object} parent The parent for the image.
   *
   * @param {string} image The source path for the image.
   *
   * @param {string} alt The alternate text for the image (for screen readers
   *                     and if the image path fails to load for some reason).
   */
  constructor(parent, image, alt)
  {
    // The HTML for the image.
    const html = `<img src="${image}" alt="${alt}" />`;

    // Add the image to the parent.
    parent.append(html);

    // Save the relevant image member variables for later use.
    this.image = parent.children().last();
  }
}

/**
 * A dialog.
 */
class Dialog
{
  /**
   * Builds the dialog and adds it to the DOM.
   */
  constructor()
  {
    // The HTML for the dialog.
    let html = `<dialog></dialog}`;

    // Add the dialog to the DOM.
    $("body").append(html);

    // Save the relevant dialog member variables for later use.
    this.dialog = $("body").children().last();
  }

  /**
   * Shows the dialog.
   *
   * @param {Array} buttons An array of buttons in the dialog; each entry has
   *                        the button in the first sub-entry and the value to
   *                        return in the second sub-entry.
   *
   * @returns A Promise that resolves when the dialog is closed.
   */
  show(buttons = [])
  {
    // Capture the dialog variable for use in the Closure.
    const dialog = this.dialog;

    // Create an return a promise that is resolved when the dialog is closed.
    return(new Promise((resolve) =>
    {
      // Called when the dialog hide animation completes.
      function
      closeEnd(result)
      {
        // Remove the hide class (preparing the dialog for the next time it is
        // displayed).
        dialog.removeClass("hide");

        // Close the modal dialog.
        dialog.close();

        // Remove the end of animation event listener.
        dialog.off("animationend");

        // Remove this dialog from the stack.
        dialogStack.pop();

        // Remove the keydown event listener.
        $(document).off("keydown", keyDown);

        // Resolve the promise with the result of the dialog.
        resolve(result);
      }

      // Called when the dialog should be closed.
      function
      close(result)
      {
        // Add an end of animation event listener.
        dialog.on("animationend", () => closeEnd(result));

        // Add the hide class to the dialog, starting the close animation.
        dialog.addClass("hide");

        // Return false to prevent further event propagation.
        return(false);
      }

      // Called when there is a click (mouse or touch).
      function
      click(e)
      {
        const rect = e.target.getBoundingClientRect();

        // See if the click is outside the dialog box.
        if((rect.left > e.clientX) || (rect.right < e.clientX) ||
           (rect.top > e.clientY) || (rect.bottom < e.clientY))
        {
          // Close the dialog.
          close(-1);
        }
      }

      // Called when a key is pressed.
      function
      keyDown(e)
      {
        // Close the dialog if the escape key is pressed.
        if((e.key === "Escape") &&
           (dialogStack[dialogStack.length - 1] === dialog))
        {
          // Start the animated close of the dialog.
          close(-1);

          // Prevent any further handling of this keystroke.
          e.preventDefault();
        }
      }

      // Loop through the buttons in the dialog.
      for(let idx = 0; idx < buttons.length; idx++)
      {
        // Add the click handler to this button.
        const button = buttons[idx];
        button[0].off("click");
        button[0].on("click", () => close(button[1]));
      }

      // Register the click handler for the backdrop.
      dialog.off("click");
      dialog.on("click", click);

      // Add a keydown listener to the document to override the default Escape
      // key handling for a modal dialog (which simply closes it, instead of
      // animating the close like needed here).
      $(document).on("keydown", keyDown);

      // Add this dialog to the dialog stack.
      dialogStack.push(dialog);

      // Show the dialog.
      dialog.showModal();

      // Scroll to the top of the dialog.
      dialog.scrollTop(0);
    }));
  }
}

/**
 * Shows a confirmation dialog, waiting for it to be dismissed before returning.
 *
 * @param {string} message The message to display on the confirmation dialog.
 *
 * @param {string} yes The label for the yes button.
 *
 * @param {string} no The label for the no button.
 *
 * @returns <b>true</b> if the user selected the yes button and <b>false</b>
 *          otherwise.
 */
async function
showConfirm(message, yes = "Yes", no = "No")
{
  // See if the confirmation dialog has been created already.
  if(dialogConfirm === null)
  {
    // Create a new dialog.
    dialogConfirm = new Dialog();

    // Create a span that contains the contents in a column.
    let span = new Span(dialogConfirm.dialog, "", "flex-column");

    // Create a span for the confirmation message.
    new Span(span.span, "&nbsp");
    dialogConfirm.message = new Span(span.span, "");
    new Span(span.span, "&nbsp");

    // Create a span that contains its contents in a row.
    let span2 = new Span(span.span, "", "flex-row");

    // Create the yes and no buttons.
    dialogConfirm.buttonYes = new Button(span2.span, "");
    new Span(span2.span, "&nbsp");
    dialogConfirm.buttonNo = new Button(span2.span, "");
  }

  // Update the text in the confirmation dialog.
  dialogConfirm.message.html(message);
  dialogConfirm.buttonYes.html(yes);
  dialogConfirm.buttonNo.html(no);

  // Show the confirm dialog.
  let ret = await dialogConfirm.show([ [ dialogConfirm.buttonYes, true ],
                                       [ dialogConfirm.buttonNo, false ] ]);
  if(ret === -1)
  {
    ret = false;
  }

  // Return the user's choice.
  return(ret);
}

/**
 * Shows an alert dialog, waiting for it to be dismissed before returning.
 *
 * @param {string} message The message to display on the alert dialog.
 *
 * @param {string} button The label for the button on the alert dialog.
 */
async function
showAlert(message, button = "OK")
{
  // See if the alert dialog has been created already.
  if(dialogAlert === null)
  {
    // Create a new dialog.
    dialogAlert = new Dialog();

    // Create a span that contains the contents in a column.
    let span = new Span(dialogAlert.dialog, "", "flex-column");

    // Create a span for the alert message.
    new Span(span.span, "&nbsp");
    dialogAlert.message = new Span(span.span, "");
    new Span(span.span, "&nbsp");

    // Create the dismiss buttons.
    dialogAlert.button = new Button(span.span, "");
  }

  // Update the text in the alert dialog.
  dialogAlert.message.html(message);
  dialogAlert.button.html(button);

  // Show the alert dialog.
  await dialogAlert.show([ [ dialogAlert.button, 0 ] ]);
}

/**
 * Shows a license as a dialog.
 *
 * @param {Object} dialog The dialog that contains the license; if non-null, it
 *                        is displayed, otherwise, the license is loaded, the
 *                        dialog is constructed, and it is then displayed.
 *
 * @param {string} name The name of the software package.
 *
 * @param {string} link The hyperlink to the web page for the software package.
 *
 * @param {string} license The file that contains the license.
 *
 * @returns The dialog that contains the license.
 */
async function
showLicense(dialog, name, link, license)
{
  // Create an return a promise that is resolved when the dialog is created.
  return(new Promise((resolve) =>
  {
    /**
     * Shows the dialog.
     */
    function
    show()
    {
      // Show the dialog, with the sole button closing the dialog.
      dialog.show([ [ dialog.button, 0 ] ]);

      // Resolve the promise, returning the dialog object that was used or
      // created.
      resolve(dialog);
    }

    /**
     * Accepts the data from the fetch of the license file.
     *
     * @param {string} text The data read from the license file.
     */
    function
    done(text)
    {
      // Create a new dialog.
      dialog = new Dialog();

      // Create a span that contains the contents in a column.
      let span = new Span(dialog.dialog, "", "license-column");

      // Add a link to the software package with its name as a title.
      new Link(span.span, name, link);

      // Insert the license text, converted from Markdown to HTML.
      new Span(span.span, "&nbsp");
      new Span(span.span, markdown(text));
      new Span(span.span, "&nbsp;");

      // Insert the button to close the dialog.
      dialog.button = new Button(span.span, "OK");

      // Show the dialog.
      show();
    }

    /**
     * Handles errors when fetching the license file.
     */
    function
    fail()
    {
      // Substitute a "license file" that indicates that the real one could not
      // be loaded.
      done("&lt;license failed to load&gt;");
    }

    // See if the license dialog already exists.
    if(dialog === null)
    {
      // The license dialog does not exist, so fetch the license file.
      $.get(license).done(done).fail(fail);
    }
    else
    {
      // THe license dialog does exist, so simply show it.
      show();
    }
  }));
}

/**
 * Shows the about dialog.
 */
function
showAbout()
{
  // See if the dialog has already been created (meaning it has been viewed in
  // the past).
  if(aboutDialog === null)
  {
    // Create the dialog.
    aboutDialog = new Dialog();

    // Add a "horizontal" span to contain the dialog.  It is truly horizontal
    // on a wider screen, but becomes stacked on a smaller screen (in essence
    // making it vertical).
    let hspan = new Span(aboutDialog.dialog, "", "about");

    // Create a vertical space and place the application icon into it.  This
    // appears in the left or top portion of the horizontal span.
    let vspan = new Span(hspan.span, "", "icon flex-column");
    new Img(vspan.span, "favicon.webp", "Fuel Tracker logo");

    // Create another vertical span and place the textual description of the
    // application into it.  This appears in teh right or bottom portion of the
    // horizontal span.
    vspan = new Span(hspan.span, "", "text flex-column");
    new Span(vspan.span, "Fuel Tracker", "title");
    new Span(vspan.span, "&nbsp;");
    new Span(vspan.span, "Copyright &copy; 2025 Brian Kircher");
    new Span(vspan.span, "&nbsp;");
    let span = new Span(vspan.span);
    let link = new Link(span.span, "License");
    link.on("click", showAppLicense);
    new Span(span.span, "; uses ");
    link = new Link(span.span, "Plotly");
    link.on("click", showPlotlyLicense);
    new Span(span.span, ", ");
    link = new Link(span.span, "Font Awesome 4.7");
    link.on("click", showFontawesomeLicense);
    new Span(span.span, ", ");
    link = new Link(span.span, "jQuery");
    link.on("click", showJqueryLicense);
    new Span(span.span, ", ");
    link = new Link(span.span, "idb");
    link.on("click", showIdbLicense);
    new Span(span.span, ", and ");
    link = new Link(span.span, "drawdown");
    link.on("click", showDrawdownLicense);
    new Span(span.span, ".");
    new Span(vspan.span, "&nbsp;");

    // Add an OK button to the end for dismissing the dialog.
    aboutDialog.button = new Button(vspan.span, "OK");
  }

  // Show the about dialog.
  aboutDialog.show([ [ aboutDialog.button, 0 ] ]);
}

/**
 * Shows the application license.
 */
async function
showAppLicense()
{
  // The particulars of the application's license.
  const name = "Fuel Tracker";
  const link = "https://github.com/bckircher/FuelTracker";
  const license = "LICENSE.md";

  // Show (or create then show) the application's license.
  licenseDialog = await showLicense(licenseDialog, name, link, license);
}

/**
 * Shows the drawdown license.
 */
async function
showDrawdownLicense()
{
  // The particulars of drawdown's license.
  const name = "drawdown";
  const link = "https://github.com/adamvleggett/drawdown";
  const license = "dialogs/drawdown.md";

  // Show (or create then show) the drawdown license.
  drawdownDialog = await showLicense(drawdownDialog, name, link, license);
}

/**
 * Shows the Font Awesome 4.7 license.
 */
async function
showFontawesomeLicense()
{
  // The particulars of Font Awesome 4.7's license.
  const name = "Font Awesome 4.7";
  const link = "https://fontawesome.com/v4/";
  const license = "dialogs/fontawesome.md";

  // Show (or create then show) the Font Awesome 4.7 license.
  fontawesomeDialog = await showLicense(fontawesomeDialog, name, link,
                                        license);
}

/**
 * Shows the idb license.
 */
async function
showIdbLicense()
{
  // The particulars of idb's license.
  const name = "idb";
  const link = "https://github.com/jakearchibald/idb";
  const license = "dialogs/idb.md";

  // Show (or create then show) the JQuery license.
  idbDialog = await showLicense(idbDialog, name, link, license);
}

/**
 * Shows the JQuery license.
 */
async function
showJqueryLicense()
{
  // The particulars of JQuery's license.
  const name = "jQuery";
  const link = "https://jquery.com";
  const license = "dialogs/jquery.md";

  // Show (or create then show) the JQuery license.
  jqueryDialog = await showLicense(jqueryDialog, name, link, license);
}

/**
 * Shows the Plotly license.
 */
async function
showPlotlyLicense()
{
  // The particulars of Plotly's license.
  const name = "Plotly";
  const link = "https://plotly.com";
  const license = "dialogs/plotly.md";

  // Show (or create then show) the Plotly license.
  plotlyDialog = await showLicense(plotlyDialog, name, link, license);
}

/**
 * Shows a panel, hiding the currently-displayed panel (if any).
 *
 * @param {Panel} panel The panel to show.
 */
function
panelShow(panel)
{
  let old;

  /**
   * Called when the panel animation is complete.
   */
  function
  onAnimationEnd()
  {
    // Remove the animation class and hide the previous panel.
    old.removeClass("cover");
    old.hide();

    // Remove the animation class and event handler for the new panel.
    panel.removeClass("show");
    panel.off("animationend");

    // Indicate that the animation is no longer active.
    animationActive = false;
  }

  // Ignore this request if there is an animation already active.
  if(animationActive)
  {
    return;
  }

  // Show the new panel.
  panel.show();

  // See if there was a panel already being displayed.
  if(panelStack.length !== 0)
  {
    // Get the currently displayed panel.
    old = panelStack[panelStack.length - 1];

    // Start the cover animation of the currently displayed panel.  Note that
    // in the reduced motion case, this animation time is set to 0 seconds by
    // the CSS, and completes immediately (but from a application/Javascript
    // perspective there still an animation, reducing variants in the code
    // path).
    old.addClass("cover");

    // Start the show animation of the new panel.
    panel.addClass("show");

    // Set the function to call when the animation is complete.
    panel.on("animationend", onAnimationEnd);

    // Indicate that an animation is active.
    animationActive = true;
  }

  // Add this panel to the panel stack.
  panelStack.push(panel);
}

/**
 * Shows the previous panel, if any.
 */
function
panelPrevious()
{
  let current, old;

  /**
   * Called when the panel animation is complete.
   */
  function
  onAnimationEnd()
  {
    // Remove the animation class and hide the current panel.
    current.removeClass("hide");
    current.hide();

    // Remove the event handler for the current panel.
    current.off("animationend");

    // Remove the animation class for the old panel.
    old.removeClass("uncover");

    // Indicate that the animation is no longer active.
    animationActive = false;
  }

  // Ignore this request if there is an animation already active.
  if(animationActive)
  {
    return;
  }

  // Ignore this request if there is not a covered panel in the panel stack.
  if(panelStack.length < 2)
  {
    return;
  }

  // Remove the current panel from the end of the panel stack.
  current = panelStack.pop();

  // Get the previous panel from the end of the panel stack.
  old = panelStack[panelStack.length - 1];

  // Start the uncover animation of the previous panel.  Note that in the
  // reduced motion case, this animation time is set to 0 seconds by the CSS,
  // and completes immediately (but from a application/Javascript perspective
  // there still an animation, reducing variants in the code path).
  old.show();
  old.addClass("uncover");

  // Start the hide animation of the current panel.
  current.addClass("hide");

  // Set the function to call when the animation is complete.
  current.on("animationend", onAnimationEnd);

  // Indicate that an animation is active.
  animationActive = true;
}

/**
 * The main application panel.
 */
class MainPanel
{
  /**
   * Builds and displays the main panel.
   */
  constructor()
  {
    // Create the panel.
    let panel = new Panel("main");

    // Add elements to the header of the panel.
    let about = new Button(panel.header, fa("question-circle-o"));
    new Span(panel.header, "Fuel Tracker");
    let add = new Button(panel.header, fa("plus"));

    // Add elemnts to the footer of the panel.
    let span = new Span(panel.footer, "", "flex-row");
    let signin = new Button(span.span, fa("sign-in"));
    new Button(span.span);
    span = new Span(panel.footer, "", "flex-row");
    let upload = new Button(span.span, fa("upload"));
    let download = new Button(span.span, fa("download"));

    // Add click handlers to the buttons in the header and footer.
    about.on("click", showAbout);
    add.on("click", this.onAdd);
    download.on("click", this.onDownload);
    signin.on("click", this.onSignin);
    upload.on("click", this.onUpload);

    // Set the Z index of the panel, so that it does not cover any of the other
    // panels (without depending on the order in which the panels are created).
    panel.zIndex(0);

    // Show the panel.
    panelShow(panel);

    // Save the relevant main panel member variables for later use.
    this.panel = panel;
    this.body = panel.body;
    this.signin = signin;
  }

  /**
   * Called when the add car button is clicked.
   */
  onAdd()
  {
    // Create the car add/edit panel if needed.
    if(carAddEditPanel === null)
    {
      carAddEditPanel = new CarAddEditPanel();
    }

    // Show the car add/edit panel.
    carAddEditPanel.show();
  }

  /**
   * Called when a car tile is clicked.
   *
   * @param {Object} car The CarTile object corresponding to the car that was
   *                     clicked.
   */
  onCar(car)
  {
    // Create the car panel if needed.
    if(carPanel === null)
    {
      carPanel = new CarPanel();
    }

    // Show the car panel for this car.
    carPanel.show(car.data("carId"), car.data("year"), car.data("make"),
                  car.data("model"), car.data("purchase"),
                  car.data("mileage"));
  }

  /**
   * Called when the download button is clicked.
   */
  async onDownload()
  {
    // TODO implement this
    await showAlert("Download coming soon...");
  }

  /**
   * Called when the sign in/out button is clicked.
   */
  async onSignin()
  {
    // TODO implement this
    await showAlert("Sign in/out coming soon...");
  }

  /**
   * Called when the upload button is clicked.
   */
  async onUpload()
  {
    // TODO implement this
    await showAlert("Upload coming soon...");
  }

  /**
   * Refreshes the body of the main panel from the cars in the database.
   */
  async refresh()
  {
    let idx;
    let carIds = [];
    let years = [];
    let makes = [];
    let models = [];
    let purchases = [];
    let mileages = [];

    // Enumerate the cars in the database.
    await dbCarsEnumerate(carIds, years, makes, models, purchases, mileages);

    // Build a default ordering of the cars based on the enumeration order.
    let order = [];
    for(idx = 0; idx < carIds.length; idx++)
    {
      order[idx] = idx;
    }

    /**
     * Compares two cars to determine which should sort earlier.
     *
     * @param {integer} a The index of the first car.
     *
     * @param {integer} b The index of the second car.
     *
     * @returns A negative value if the first car should sort before the second
     *          car, zero if the cars are equal, and a positive value if the
     *          first car should sort after the second car.
     */
    function
    compare(a, b)
    {
      let comp;

      // The first sort criteria is the model year of the car; newer cars are
      // sorted before older cars.
      comp = years[b] - years[a];
      if(comp != 0)
      {
        return(comp);
      }

      // These two cars are from the same model year; the second sort criteria
      // is the make (manufacturer) of the cars; they are sorted
      // alphabetically.
      comp = makes[a].localeCompare(makes[b]);
      if(comp != 0)
      {
        return(comp);
      }

      // These two cars are the same make; the third sort criteria is the model
      // of the cars; they are also sorted alphabetically.
      comp = models[a].localeCompare(models[b]);
      if(comp != 0)
      {
        return(comp);
      }

      // These two cars are the same model; the final sort criteria is the
      // purchase date.
      comp = purchases[a].localeCompare(purchases[b]);
      return(comp);
    }

    // Sort the cars.
    order.sort(compare);

    // Remove the current content of the panel's body.
    this.body.empty();

    // Loop through the cars.
    for(idx = 0; idx < carIds.length; idx++)
    {
      // Create a tile for this car, using the sort order to go through the
      // cars.
      const car = new CarTile(this.body, carIds[order[idx]], years[order[idx]],
                              makes[order[idx]], models[order[idx]],
                              purchases[order[idx]], mileages[order[idx]]);

      // Add a click handler to this car tile.
      car.on("click", () => this.onCar(car));
    }
  }
}

/**
 * A tile that shows details of a car within the main panel.
 */
class CarTile
{
  /**
   * Builds a car tile and adds is to the DOM.
   *
   * @param {Object} parent The DOM element to which to add the car tile.
   *
   * @param {string} carId The database ID of the car.
   *
   * @param {string} year The model year of the car.
   *
   * @param {string} make The make (manufacturer) of the car.
   *
   * @param {string} model The model of the car.
   *
   * @param {string} purchase The purchase date of the car.
   *
   * @param {string} mileage The mileage of the car at the time of purchase.
   */
  constructor(parent, carId, year, make, model, purchase, mileage)
  {
    // Construct the HTML for the car tile.
    const html = `<div class="car_tile">` +
                 `  <span class="info">${year} ${make} ${model}</span>` +
                 `  <span class="arrow fa fa-chevron-right"></span>` +
                 `</div>`;

    // Add the car tile to the DOM.
    parent.append(html);

    // Save the relevant car tile member variables for later use.
    this.tile = parent.children().last();

    // Save the details of this car to data elements of the car tile.
    this.data("carId", carId);
    this.data("year", year);
    this.data("make", make);
    this.data("model", model);
    this.data("purchase", purchase);
    this.data("mileage", mileage);
  }

  /**
   * Adds an event handler to the car tile.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.tile.on(event, fn);
  }

  /**
   * Removes an event handler from the car tile.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.tile.off(event);
  }

  /**
   * Gets or sets a data item for this tile.
   *
   * @param {string} tag The name of the data item.
   *
   * @param {string} value The value of the data item; if not provided, the
   *                       current value of the data item is returned.
   *
   * @returns The current value of the data item if a value is not provided.
   */
  data(tag, value = undefined)
  {
    if(value === undefined)
    {
      return(this.tile.data(tag));
    }
    else
    {
      this.tile.data(tag, value);
    }
  }
}

/**
 * A panel for adding or editing the details of a car.
 */
class CarAddEditPanel
{
  /**
   * Builds the car add/edit panel and adds it to the DOM.
   */
  constructor()
  {
    // Create the panel.
    let panel = new Panel("addEditCar");

    // Add elements to the header of the panel.
    let back = new Button(panel.header, fa("chevron-left"));
    let title = new Span(panel.header);
    let save = new Button(panel.header, fa("save"));

    // Add elements to the body of the panel, providing all the inputs needed
    // to capture information about the car.
    let span = new Span(panel.body, "", "flex-column");
    new Span(span.span, "&nbsp;");
    new Span(span.span, "Year", "heading");
    let year = new Input(span.span, "number", "model year");
    year.on("change", () => this.onChange(this));
    new Span(span.span, "&nbsp;");
    new Span(span.span, "Make", "heading");
    let make = new Input(span.span, "text", "manufacturer");
    make.on("change", () => this.onChange(this));
    new Span(span.span, "&nbsp;");
    new Span(span.span, "Model", "heading");
    let model = new Input(span.span, "text", "model");
    model.on("change", () => this.onChange(this));
    new Span(span.span, "&nbsp;");
    new Span(span.span, "Purchase Date", "heading");
    let purchase = new Input(span.span, "date");
    purchase.on("change", () => this.onChange(this));
    new Span(span.span, "&nbsp");
    new Span(span.span, "Purchase Mileage", "heading");
    let mileage = new Input(span.span, "number", "mileage at purchase");
    mileage.on("change", () => this.onChange(this));

    // Add click handlers to the buttons in the header.
    back.on("click", () => this.onBack(this));
    save.on("click", () => this.onSave(this));

    // Set the Z index of the panel, so that it covers both the main panel and
    // the car panel (without depending on the order in which the panels are
    // created).
    panel.zIndex(20);

    // Save the relevant car add/edit panel member variables for later use.
    this.panel = panel;
    this.title = title;
    this.year = year;
    this.make = make;
    this.model = model;
    this.purchase = purchase;
    this.mileage = mileage;
  }

  /**
   * Called when one of the inputs on the panel is changed.
   *
   * @param {Object} obj The car add/edit panel object (required since this is
   *                     called by an event handler).
   */
  onChange(obj)
  {
    // Indicate that the state of the panel has been modified.
    obj.modified = true;
  }

  /**
   * Called when the back button is clicked.
   *
   * @param {Object} obj The car add/edit panel object (required since this is
   *                     called by an event handler).
   */
  async onBack(obj)
  {
    /**
     * Transitions to the previous application panel.
     */
    function
    goBack()
    {
      panelPrevious();
    }

    // See if the inputs on the panel have been changed.
    if(obj.modified)
    {
      // Confirm that the user wants to discard their changes.
      if(await showConfirm(`Are you sure you want to discard your ` +
                           `changes?`) === true)
      {
        // The discard was confirmed, so transition to the previous panel.
        goBack();
      }
    }
    else
    {
      // There are no changes, so transition to the previous panel.
      goBack();
    }
  }

  /**
   * Called when the save button is clicked.
   *
   * @param {Object} obj The car add/edit panel object (required since this is
   *                     called by an event handler).
   */
  async onSave(obj)
  {
    // Get the details from the panel.
    let year = parseInt(obj.year.val());
    let make = obj.make.val();
    let model = obj.model.val();
    let purchase = obj.purchase.val();
    let mileage = parseInt(obj.mileage.val());

    // See if this is an add or edit.
    if(obj.add)
    {
      // Add a new car.
      await dbCarAdd(year, make, model, purchase, mileage);
    }
    else
    {
      // Update the details of this car.
      await dbCarUpdate(obj.carId, year, make, model, purchase, mileage);

      // Update the title bar info on the car panel.
      carPanel.updateInfo(year, make, model, purchase, mileage);
    }

    // Update the car tiles on the main panel.
    await mainPanel.refresh();

    // The state of the panel is no longer modified (since it has been saved to
    // the database).
    obj.modified = false;

    // Go to the previous panel.
    this.onBack(obj);
  }

  /**
   * Shows the car add/edit panel.
   *
   * @param {integer} carId The database ID of the car (or null when adding a
   *                        new car).
   *
   * @param {integer} year The model year of the car (or null when adding a new
   *                       car).
   *
   * @param {string} make The make of the car (or null when adding a new car).
   *
   * @param {string} model The model of the car (or null when adding a new
   *                       car).
   *
   * @param {string} purchase The purchase date (or null when adding a new
   *                          car).
   *
   * @param {integer} mileage The car's mileage at the time of purchase (or
   *                          null when adding a new car).
   */
  show(carId = null, year = null, make = null, model = null, purchase = null,
       mileage = null)
  {
    // See if a car is being added or edited.
    if((carId === null) && (year === null) && (make === null) &&
       (model === null) && (purchase === null) && (mileage === null))
    {
      // A car is being added, so set the panel title appropriately.
      this.title.html("Add Car");

      // Save the fact that a new car is being added.
      this.add = true;
    }
    else
    {
      // A car is being edited, so set the panel title appropriately.
      this.title.html("Edit Car");

      // Save the fact that the car is being edited.
      this.add = false;
    }

    // Set the values of the inputs.
    this.year.val((year === null) ? "" : year);
    this.make.val((make === null) ? "" : make);
    this.model.val((model === null) ? "" : model);
    this.purchase.val((purchase === null) ?
                      new Date().toLocaleDateString("en-ca") : purchase);
    this.mileage.val((mileage === null) ? "" : mileage);

    // Save the car ID for later use.
    this.carId = carId;

    // The panel starts in an unmodified state.
    this.modified = false;

    // Show this panel.
    panelShow(this.panel);
  }
}

/**
 * A panel for showing fill-ups for a car.
 */
class CarPanel
{
  /**
   * Builds the car panel and adds it to the DOM.
   */
  constructor()
  {
    // Create the panel.
    let panel = new Panel("car");

    // Add elements to the header of the panel.
    let back = new Button(panel.header, fa("chevron-left"));
    let title = new Span(panel.header);
    let add = new Button(panel.header, fa("plus"));

    // Add elements to the footer of the panel.
    let graph = new Button(panel.footer, fa("line-chart"));
    let trash = new Button(panel.footer, fa("trash"));

    // Add click handlers to the buttons in the header and footer.
    add.on("click", () => this.onAdd(this));
    back.on("click", panelPrevious);
    graph.on("click", () => this.onGraph(this));
    title.on("click", () => this.onEdit(this));
    trash.on("click", () => this.onTrash(this));

    // Set the Z index of the panel, so that it covers the main panel but is
    // covered by the car add/edit panel and the fuel add/edit panel (without
    // depending on the order in which the panels are created).
    panel.zIndex(10);

    // Save the relevant car panel member variables for later use.
    this.panel = panel;
    this.body = panel.body;
    this.title = title;
  }

  /**
   * Called when the add fuel button is clicked.
   */
  onAdd(obj)
  {
    // Create the fuel add/edit panel if needed.
    if(fuelAddEditPanel === null)
    {
      fuelAddEditPanel = new FuelAddEditPanel();
    }

    // Show the fuel add/edit panel.
    fuelAddEditPanel.show(obj.carId);
  }

  /**
   * Called when the car description is clicked.
   */
  onEdit(obj)
  {
    // Create the car add/edit panel if needed.
    if(carAddEditPanel === null)
    {
      carAddEditPanel = new CarAddEditPanel();
    }

    // Show the car add/edit panel for this car.
    carAddEditPanel.show(obj.carId, obj.year, obj.make, obj.model,
                         obj.purchase, obj.mileage);
  }

  /**
   * Called when a fuel tile is clicked.
   *
   * @param {Object} obj The object for this car.
   *
   * @param {Object} tile The object for the fuel tile
   */
  onFuel(obj, tile)
  {
    // Create the fuel add/edit panel if necessary.
    if(fuelAddEditPanel === null)
    {
      fuelAddEditPanel = new FuelAddEditPanel();
    }

    // Show the fuel add/edit panel for this fill-up.
    fuelAddEditPanel.show(obj.carId, tile.data("fuelId"), tile.data("date"),
                          tile.data("mileage"), tile.data("price"),
                          tile.data("quantity"), tile.data("total"),
                          tile.data("partial"), tile.data("missed"));
  }

  /**
   * Called when the graph button is clicked.
   */
  async onGraph(obj)
  {
    // TODO implement this
    await showAlert("Graphs coming soon...");
  }

  /**
   * Called when the delete button is clicked.
   */
  async onTrash(obj)
  {
    // Confirm that the user wants to delete this car.
    if(await showConfirm(`Are you sure you want to delete your ${this.year} ` +
                         `${this.make} ${this.model}?`) === false)
    {
      return;
    }

    // Delete this car from the database.
    await dbCarDelete(obj.carId);

    // Update the main panel from the database.
    await mainPanel.refresh();

    // Go to the previous panel.
    panelPrevious();
  }

  /**
   * Updates the infomation about this car.
   *
   * @param {integer} year The model year of the car.
   *
   * @param {string} make The make (manufacturer) of the car.
   *
   * @param {string} model The model of the car.
   *
   * @param {string} purchase The purchase date of the car.
   *
   * @param {integer} mileage The mileage of the car at the time of purchase.
   */
  updateInfo(year, make, model, purchase, mileage)
  {
    // Update the title in the header.
    this.title.html(`${year} ${make} ${model}`);

    // Save the details of this car for later.
    this.year = year;
    this.make = make;
    this.model = model;
    this.purchase = purchase;
    this.mileage = mileage;
  }

  /**
   * Updates the list of fill-up records for this car.
   */
  async updateRecords()
  {
    let idx;
    let fuelIDs = [];
    let dates = [];
    let mileages = [];
    let prices = [];
    let quantities = [];
    let totals = [];
    let partials = [];
    let misses = [];

    // Get the list of fill-up records for this car.
    await dbFuelEnumerate(this.carId, fuelIDs, dates, mileages, prices,
                          quantities, totals, partials, misses);

    // Remove everything from the panel's body.
    this.body.html("");

    // See if there are any fill-up records for this car.
    if(fuelIDs.length === 0)
    {
      // Add an empty fill-up record tile.
      new FuelTile(this.body);

      // There is nothing further to do.
      return;
    }

    // Build a default ordering of the cars based on the enumeration order.
    let order = [];
    for(idx = 0; idx < fuelIDs.length; idx++)
    {
      order[idx] = idx;
    }

    /**
     * Compares two fill-ups to determine which should sort earlier.
     *
     * @param {integer} a The index of the first fill-up.
     *
     * @param {integer} b The index of the second fill-up.
     *
     * @returns A negative value if the first fill-up should sort before the
     *          second fill-up car, zero if the fill-ups are equal, and a
     *          positive value if the first fill-up should sort after the
     *          second fill-up.
     */
    function
    compare(a, b)
    {
      // The fill-ups are sorted based on the car's mileage at the time of the
      // fill-up.
      return(mileages[b] - mileages[a]);
    }

    // Sort the fill-ups.
    order.sort(compare);

    // Loop through the fill-ups.
    for(let idx = 0; idx < fuelIDs.length; idx++)
    {
      // Create a fuel for this fill-up, using the sort order to go through the
      // fill-ups.
      const tile = new FuelTile(this.body, this.carId, fuelIDs[order[idx]],
                                dates[order[idx]], mileages[order[idx]],
                                prices[order[idx]], quantities[order[idx]],
                                totals[order[idx]], partials[order[idx]],
                                misses[order[idx]]);

      // Add a click handler to this fill-up tile.
      tile.on("click", () => this.onFuel(this, tile));
    }
  }

  /**
   * Shows the car panel for a car.
   *
   * @param {integer} carId The database ID of the car.
   *
   * @param {integer} year The model year of the car.
   *
   * @param {string} make The make (manufacturer) of the car.
   *
   * @param {string} model The model of the car.
   *
   * @param {string} purchase The purchase date of the car.
   *
   * @param {integer} mileage The mileage of the car at the time of purchase.
   */
  async show(carId, year, make, model, purchase, mileage)
  {
    // Save the car ID.
    this.carId = carId;

    // Update the car panel's header.
    this.updateInfo(year, make, model, purchase, mileage);

    // Update the fill-up records in the panel's body.
    await this.updateRecords();

    // Show this panel.
    panelShow(this.panel);
  }
}

/**
 * A tile that shows details of a fill-up within the car panel.
 */
class FuelTile
{
  /**
   * Builds a fuel tile and adds it to the DOM.
   *
   * @param {Object} parent The DOM element to which to add the fuel tile.
   *
   * @param {integer} carId The database ID of the car.
   *
   * @param {integer} fuelId The database ID of the fill-up.
   *
   * @param {string} date The date of the fill-up.
   *
   * @param {integer} mileage The car's mileage at the time of the fill-up.
   *
   * @param {flaot} price The price/unit of fuel.
   *
   * @param {float} quantity The quantity of fuel purchased.
   *
   * @param {float} total The total spent on the fuel purchase.
   *
   * @param {boolean} partial Was this fill-up a partial fill-up?
   *
   * @param {boolean} missed Does this fill-up represent the first after one
   *                         that was not recorded?
   */
  constructor(parent, carId = "", fuelId = "", date = "", mileage = "",
              price = "", quantity = "", total = "", partial = "", missed = "")
  {
    let html;

    // See if there is a ID for the car.
    if(carId === "")
    {
      // Construct the HTML for a fuel tile that indicates that there are no
      // fill-up records.
      html = `<div class="fuel_tile">` +
             `  <span class="empty">No records</span>` +
             `</div>`;
    }
    else
    {
      // Construct the HTML for the fuel tile.
      html = `<div class="fuel_tile">` +
             `  <span class="date">${fa("calendar")}&nbsp;${date}</span>` +
             `  <span class="mileage">${fa("car")}&nbsp;${mileage}</span>` +
             `  <span class="price">${fa("tint")}&nbsp;${fa("usd")}` +
             `${parseFloat(price).toFixed(3)}</span>` +
             `  <span class="quantity">${fa("tachometer")}&nbsp;` +
             `${parseFloat(quantity).toFixed(3)}</span>` +
             `  <span class="total">${fa("credit-card")}&nbsp;${fa("usd")}` +
             `${parseFloat(total).toFixed(2)}</span>` +
             `</div>`;
    }

    // Add the fuel tile to the DOM.
    parent.append(html);

    // Save the relevant fuel tile member variables for later use.
    this.tile = parent.children().last();

    // Save the details of this fill-up to data elements of the car tile.
    this.data("carId", carId);
    this.data("fuelId", fuelId);
    this.data("date", date);
    this.data("mileage", mileage);
    this.data("price", price);
    this.data("quantity", quantity);
    this.data("total", total);
    this.data("partial", partial);
    this.data("missed", missed);
  }

  /**
   * Adds an event handler to the fuel tile.
   *
   * @param {string} event The name of the event.
   *
   * @param {Function} fn The function to call when the event occurs.
   */
  on(event, fn)
  {
    this.tile.on(event, fn);
  }

  /**
   * Removes an event handler from the fuel tile.
   *
   * @param {string} event The name of the event.
   */
  off(event)
  {
    this.tile.off(event);
  }

  /**
   * Gets or sets a data item for this tile.
   *
   * @param {string} tag The name of the data item.
   *
   * @param {string} value The value of the data item; if not provided, the
   *                       current value of the data item is returned.
   *
   * @returns The current value of the data item if a value is not provided.
   */
  data(tag, value = undefined)
  {
    if(value === undefined)
    {
      return(this.tile.data(tag));
    }
    else
    {
      this.tile.data(tag, value);
    }
  }
}

/**
 * A panel for adding or editing the details of a fill-up.
 */
class FuelAddEditPanel
{
  /**
   * Builds the fuel add/edit panel and adds it to the DOM.
   */
  constructor()
  {
    // Create the panel.
    let panel = new Panel("addEditFuel");

    // Add elements to the header of the panel.
    let back = new Button(panel.header, fa("chevron-left"));
    let title = new Span(panel.header);
    let save = new Button(panel.header, fa("save"));

    // Add elements to the body of the panel, providing all the inputs needed
    // to cpature information about the fill-up.
    let span = new Span(panel.body, "", "flex-column");
    new Span(span.span, "&nbsp;");
    new Span(span.span, `<i class="fa fa-calendar"></i>&nbsp;Date`, "heading");
    let date = new Input(span.span, "date");
    date.on("input", () => this.onInput(this, 0));
    new Span(span.span, "&nbsp");
    new Span(span.span, `<i class="fa fa-car"></i>&nbsp;Mileage`, "heading");
    let mileage = new Input(span.span, "number", "mileage");
    mileage.on("input", () => this.onInput(this, 0));
    new Span(span.span, "&nbsp;");
    new Span(span.span, `<i class="fa fa-tint"></i>&nbsp;Price/gallon`,
             "heading");
    let price = new Input(span.span, "number", "price per gallon");
    price.on("input", () => this.onInput(this, 1));
    new Span(span.span, "&nbsp;");
    new Span(span.span, `<i class="fa fa-tachometer"></i>&nbsp;Gallons`,
             "heading");
    let quantity = new Input(span.span, "number", "number of gallons");
    quantity.on("input", () => this.onInput(this, 2));
    new Span(span.span, "&nbsp;");
    new Span(span.span, `<i class="fa fa-credit-card"></i>&nbsp;Total`,
             "heading");
    let total = new Input(span.span, "number", "total cost");
    total.on("input", () => this.onInput(this, 3));
    new Span(span.span, "&nbsp;");
    let partial = new Toggle(span.span, "Partial fillup?");
    partial.on("change", () => this.onInput(this, 0));
    new Span(span.span, "&nbsp;");
    let missed = new Toggle(span.span, "Missed fillup?");
    missed.on("change", () => this.onInput(this, 0));

    // Add elements to the footer of the panel.
    new Span(panel.footer);
    let trash = new Button(panel.footer, fa("trash"));
    new Span(panel.footer);

    // Add click handlers to the buttons in the header and footer.
    back.on("click", () => this.onBack(this));
    save.on("click", () => this.onSave(this));
    trash.on("click", () => this.onTrash(this));

    // Set teh Z index of the panel, so that it covers both the main panel and
    // the car panel (without depending on the order in which the panels are
    // created).
    panel.zIndex(30);

    // Save the relevant fueld add/edit panel member variables for later use.
    this.panel = panel;
    this.title = title;
    this.date = date;
    this.mileage = mileage;
    this.price = price;
    this.quantity = quantity;
    this.total = total;
    this.partial = partial;
    this.missed = missed;
    this.trash = trash;
  }

  /**
   * Called when one of the inputs on the panel is changed.
   *
   * @param {Object} obj The fuel add/edit panel object (required since this is
   *                     called by an event handler).
   *
   * @param {integer} item The identifier of the item that changed; 1 if the
   *                       price/unit chnaged, 2 if the quantity changed, and 0
   *                       otherwise.
   */
  onInput(obj, item)
  {
    // Indicate that the state of the panel has been modified.
    obj.modified = true;

    // See if the price/unit or the quantity changed.
    if((item === 1) || (item === 2))
    {
      // Get the price/unit.
      const price = this.price.val();

      // Get the quantity.
      const quantity = this.quantity.val();

      // See if they are both not empty.
      if((price !== "") && (quantity !== ""))
      {
        // Compute the total price.
        const total = price * quantity;

        // Update the total price based on the price/unit and quantity.
        this.total.val(total.toFixed(2));
      }
    }
  }

  /**
   * Called when the back button is clicked.
   *
   * @param {Object} obj The fuel add/edit panel object (required since this is
   *                     called by an event handler).
   */
  async onBack(obj)
  {
    /**
     * Transitions to the previous application panel.
     */
    function
    goBack()
    {
      panelPrevious();
    }

    // See if the inputs on the panel have been changed.
    if(obj.modified)
    {
      // Confirm that the user wants to discard their changes.
      if(await showConfirm(`Are you sure you want to discard your ` +
                           `changes?`) === true)
      {
        // The discard was confirmed, so transition to the previous panel.
        goBack();
      }
    }
    else
    {
      // There are no changes, so transition to the previous panel.
      goBack();
    }
  }

  /**
   * Called when the save button is clicked.
   *
   * @param {Object} obj The fuel add/edit panel object (required since this is
   *                     called by an event handler).
   */
  async onSave(obj)
  {
    // Get the details from the panel.
    let date = obj.date.val();
    let mileage = parseInt(obj.mileage.val());
    let price = parseFloat(obj.price.val());
    let quantity = parseFloat(obj.quantity.val());
    let total = parseFloat(obj.total.val());
    let partial = (obj.partial.val() === "on") ? true : false;
    let missed = (obj.missed.val() === "on") ? true : false;

    // See if this is an add or edit.
    if(obj.add)
    {
      // Add a new fill-up.
      await dbFuelAdd(obj.carId, date, mileage, price, quantity, total,
                      partial, missed);
    }
    else
    {
      // Update the details of this fill-up.
      await dbFuelUpdate(obj.fuelId, obj.carId, date, mileage, price, quantity,
                         total, partial,  missed);
    }

    // Update the fuel tiles on the car panel.
    carPanel.updateRecords();

    // The state of the panel is no longer modified (since it has been saved to
    // the database).
    obj.modified = false;

    // Go to the previous panel.
    this.onBack(obj);
  }

  /**
   * Called when the trash button is clicked.
   *
   * @param {Object} obj The fuel add/edit panel object (required since this is
   *                     called by an event handler).
   */
  async onTrash(obj)
  {
    // Confirm that the user wants to delete this fill-up.
    if(await showConfirm(`Are you sure you want to delete this fuel ` +
                         `record?`) === true)
    {
      // Delete this fill-up record.
      await dbFuelDelete(obj.fuelId);

      // Update the fuel tiles on the car panel.
      carPanel.updateRecords();

      // The state of the panel is no longer modified (since it has been saved
      // to the database).
      obj.modified = false;

      // Go to the previous panel.
      this.onBack(obj);
    }
  }

  /**
   * Shows the fuel add/edit panel.
   *
   * @param {integer} carId The database ID of the car.
   *
   * @param {integer} fuelId The database ID of the fill-up (or null when
   *                         adding a new fill-up).
   *
   * @param {string} date The date of the fill-up (or null when adding a new
   *                      fill-up).
   *
   * @param {integer} mileage The car's mileage at the time of the fill-up (or
   *                           null when adding a new fill-up).
   *
   * @param {float} price The price/unit of the fuel (or null when adding a new
   *                       fill-up).
   *
   * @param {float} quantity The quantity of fuel added (or null when adding a
   *                         new fill-up).
   *
   * @param {float} cost The total cost of the fuel (or null when adding a new
   *                     fill-up).
   *
   * @param {boolean} partial <b>True</b> when this is a partial fill-up (or
   *                          null when adding a new fill-up).
   *
   * @param {boolean} missed <b>True</b> when the previous fill-up was not
   *                         recorded (or null when adding a new fill-up).
   */
  show(carId, fuelId = null, date = null, mileage = null, price = null,
       quantity = null, cost = null, partial = null, missed = null)
  {
    // See if a fill-up is being added or edited.
    if((fuelId === null) && (date === null) && (mileage === null) &&
       (price === null) && (quantity === null) && (cost === null) &&
       (partial === null) && (missed === null))
    {
      // A fill-up is being added, so set the panel title appropriately.
      this.title.html("Add Fuel");

      // Save the fact that a new car is being added.
      this.add = true;

      // Hide the delete button (since a new/non-existant fill-up can not be
      // deleted).
      this.trash.hide();
    }
    else
    {
      // A fill-up is being edited, so set the panel title appropriately.
      this.title.html("Edit Fuel");

      // Save the fact that the car is being edited.
      this.add = false;

      // Show the delete button.
      this.trash.show();
    }

    // Set the values of the inputs.
    this.date.val((date === null) ? new Date().toLocaleDateString("en-ca") :
                  date);
    this.mileage.val((mileage === null) ? "" : mileage);
    this.price.val((price === null) ? "" : parseFloat(price).toFixed(3));
    this.quantity.val((quantity === null) ? "" :
                      parseFloat(quantity).toFixed(3));
    this.total.val((cost === null) ? "" : parseFloat(cost).toFixed(2));
    this.partial.val((partial === null) ? false : partial);
    this.missed.val((missed === null) ? false : missed);

    // Save the car and fuel IDs for later use.
    this.carId = carId;
    this.fuelId = fuelId;

    // The panel starts in an unmodified state.
    this.modified = false;

    // Show this panel.
    panelShow(this.panel);
  }
}

/**
 * Called when the DOM has completed loading.
 */
async function
loaded()
{
  // Connect to IndexedDB.
  await dbOpen();

  // Create and refresh the main panel.
  mainPanel = new MainPanel();
  await mainPanel.refresh();
}

// Call the load function when the entire DOM has been loaded.
$(document).on("DOMContentLoaded", loaded);

// See if the user agent support a service worker.
if("serviceWorker" in navigator)
{
  // Only register a service worker if not being served from localhost (in
  // other words, development).
  if((window.location.hostname !== "localhost") &&
     (window.location.hostname !== "[::1]") &&
     !window.location.hostname.
        match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/))
  {
    // Set a function to call when the window has finished loading.
    $(window).on("load", function()
    {
      // Register the service worker.
      navigator.serviceWorker
        .register("sw.js")
        .then(res => { })
        .catch(err => console.log("service worker not registered", err));
    })
  }
}