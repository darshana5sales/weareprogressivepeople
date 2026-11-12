/* ============================================================
   Progressive People - wix-forms.js
   Draws the Wix forms (Hire talent, Submit your CV, Newsletter)
   in the site's own form styles and sends submissions to Wix.

   The fields come from each form in the Wix dashboard, so a renamed
   field, a new choice or a changed thank-you message shows here
   without a code change. Wix's form layer (./wix/) handles the
   validation, uploads and the submission.

   Markup on the page:
     <form data-wix-form="<form id>" data-wix-layout="panel|inline"
           data-wix-fallback="Message if the form can't load">
       <div data-wix-fields></div>      fields go here
       <button type="submit" data-wix-submit>…</button>
       <div data-wix-extras></div>      inline only: tick-boxes and errors
       <p data-wix-status hidden></p>   form-level messages
     </form>
   ============================================================ */
import { createFormStore, FORM_ERROR, otherText, otherValue } from "./wix/form-store.js";

var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ESC[c]; }); }

// Controls that take the full width of the form instead of half a row.
var WIDE = { textarea: 1, file: 1, signature: 1, checkbox: 1, checkboxGroup: 1, radio: 1, tags: 1, address: 1, rating: 1, payment: 1, appointment: 1, unknown: 1 };
var INPUT_TYPES = { email: "email", url: "url", phone: "tel", password: "password", number: "number", date: "date", time: "time", datetime: "datetime-local" };
var OTHER = "__other__";

document.querySelectorAll("form[data-wix-form]").forEach(function (formEl, n) { setup(formEl, n); });

function setup(formEl, n) {
  var formId = formEl.getAttribute("data-wix-form");
  var inline = formEl.getAttribute("data-wix-layout") === "inline";
  var fieldsEl = formEl.querySelector("[data-wix-fields]");
  var extrasEl = formEl.querySelector("[data-wix-extras]") || fieldsEl;
  var statusEl = formEl.querySelector("[data-wix-status]");
  var button = formEl.querySelector("[data-wix-submit]");
  var prefix = "wf" + n + "-";
  var built = "";            // the targets currently drawn, to redraw only when they change
  var byTarget = {};

  if (!formId || !fieldsEl) return;
  if (!inline) fieldsEl.innerHTML = '<p class="form__loading">Loading form&hellip;</p>';

  var store = createFormStore({ formId: formId });
  store.subscribe(render);
  render(store.getState());
  store.start();

  // ---- events: one listener per form, so redraws keep them ----
  function onValue(e) {
    var t = e.target, name = t.name;
    if (!name || !byTarget[name.split("/")[0]]) return;
    var f = byTarget[name];
    if (t.type === "file") {
      store.setValue(name, Array.from(t.files || []));
      var span = t.parentNode.querySelector("[data-file-text]");
      if (span) span.textContent = t.files && t.files.length ? Array.from(t.files).map(function (x) { return x.name; }).join(", ") : (f.buttonText || "Choose a file");
    } else if (t.type === "checkbox" && t.hasAttribute("data-group")) {
      var boxes = formEl.querySelectorAll('input[name="' + name + '"]');
      store.setValue(name, Array.from(boxes).filter(function (b) { return b.checked; }).map(function (b) { return b.value; }));
    } else if (t.type === "checkbox") {
      store.setValue(name, t.checked);
    } else if (t.hasAttribute("data-other-text")) {
      store.setValue(name, otherValue(f, t.value));
    } else if (t.tagName === "SELECT" && t.value === OTHER) {
      var other = formEl.querySelector('[data-other-text][name="' + name + '"]');
      store.setValue(name, otherValue(f, other ? other.value : ""));
    } else if (f && f.control === "number") {
      store.setValue(name, t.value === "" ? "" : Number(t.value));
    } else {
      store.setValue(name, t.value);
    }
  }
  formEl.addEventListener("input", onValue);
  formEl.addEventListener("change", onValue);
  formEl.addEventListener("focusout", function (e) {
    if (e.target.name && byTarget[e.target.name]) store.validate(e.target.name);
  });
  formEl.addEventListener("submit", function (e) {
    var s = store.getState();
    if (s.form && s.step < s.form.steps.length - 1) store.next(e); else store.submit(e);
  });

  // ---- drawing ----
  function render(s) {
    if (s.outcome) return showOutcome(s.outcome);
    if (!s.form) {
      if (s.errors[FORM_ERROR] && !s.loading) showUnavailable();
      setBusy(s.loading);
      return;
    }
    if (s.closed) return showMessage(s.form.disabledMessage || formEl.getAttribute("data-wix-fallback") || "This form is closed.");

    var step = s.form.steps[s.step];
    var fields = s.form.fields.filter(function (f) { return !step || f.stepId === step.id; });
    var key = fields.map(function (f) { return f.target + ":" + f.required + ":" + f.choices.length; }).join("|");
    if (key !== built) { draw(fields, s); built = key; }

    fields.forEach(function (f) {
      var err = s.errors[f.target] || "";
      var errEl = formEl.querySelector("#" + prefix + "err-" + f.target);
      if (errEl) { errEl.textContent = err; errEl.hidden = !err; }
      formEl.querySelectorAll('[name="' + f.target + '"]').forEach(function (c) {
        if (err) c.setAttribute("aria-invalid", "true"); else c.removeAttribute("aria-invalid");
      });
      var otherWrap = formEl.querySelector('[data-other-wrap="' + f.target + '"]');
      if (otherWrap) otherWrap.hidden = otherText(f, s.values[f.target]) == null;
    });

    if (statusEl) {
      var formErr = s.errors[FORM_ERROR] || "";
      statusEl.textContent = formErr;
      statusEl.hidden = !formErr;
    }
    if (button && s.form.submitText && !button.hasAttribute("data-label-set")) {
      button.textContent = s.form.submitText;
      button.setAttribute("data-label-set", "");
    }
    setBusy(s.loading);
  }

  function draw(fields, s) {
    byTarget = {};
    fields.forEach(function (f) { byTarget[f.target] = f; });

    if (inline) {
      // One row: the text inputs beside the button; tick-boxes and errors underneath.
      var main = "", extra = "";
      fields.forEach(function (f) {
        if (f.control === "checkbox") extra += fieldHtml(f, s, false);
        else {
          main += '<label class="sr-only" for="' + prefix + f.target + '">' + esc(f.label) + "</label>" + control(f, s);
          extra += errorHtml(f);
        }
      });
      fieldsEl.innerHTML = main;
      extrasEl.innerHTML = extra;
      return;
    }

    // Panel: short fields pair up two to a row; long ones, and a short one left on its own, take the width.
    var html = "", pending = null;
    fields.forEach(function (f, i) {
      var next = fields[i + 1];
      var wide = WIDE[f.control] || (!pending && (!next || WIDE[next.control]));
      if (wide) {
        if (pending) { html += '<div class="form__row">' + pending + "</div>"; pending = null; }
        html += fieldHtml(f, s, true);
      } else if (pending) {
        html += '<div class="form__row">' + pending + fieldHtml(f, s, true) + "</div>";
        pending = null;
      } else {
        pending = fieldHtml(f, s, true);
      }
    });
    if (pending) html += pending;
    fieldsEl.innerHTML = html;
  }

  function fieldHtml(f, s, withLabel) {
    var id = prefix + f.target;
    var req = f.required ? ' <span class="form__req" aria-hidden="true">*</span>' : "";
    var html = '<div class="form__field">';
    if (f.control === "checkbox") {
      html += '<label class="form__check"><input type="checkbox" id="' + id + '" name="' + esc(f.target) + '"' +
        (s.values[f.target] === true ? " checked" : "") + (f.required ? " required" : "") + "><span>" + esc(f.label) + "</span></label>";
    } else if (f.control === "radio" || f.control === "checkboxGroup" || f.control === "tags") {
      html += '<fieldset class="form__choices"><legend class="form__label">' + esc(f.label) + req + "</legend>" + control(f, s) + "</fieldset>";
    } else {
      if (withLabel) html += '<label class="form__label' + (f.showLabel ? "" : " sr-only") + '" for="' + id + '">' + esc(f.label) + req + "</label>";
      html += control(f, s);
    }
    if (f.description) html += '<span class="form__hint">' + esc(f.description) + "</span>";
    return html + errorHtml(f) + "</div>";
  }

  function errorHtml(f) {
    return '<p class="form__error" id="' + prefix + "err-" + f.target + '" role="alert" hidden></p>';
  }

  function control(f, s) {
    var id = prefix + f.target, name = esc(f.target), v = s.values[f.target];
    var common = ' id="' + id + '" name="' + name + '" aria-describedby="' + prefix + "err-" + f.target + '"' +
      (f.required ? " required" : "") + (f.readOnly ? " disabled" : "");
    var ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "";

    switch (f.control) {
      case "textarea":
        return '<textarea class="form__textarea"' + common + ph + ">" + esc(v || "") + "</textarea>";

      case "select": {
        var other = f.otherOption && otherText(f, v) != null;
        var opts = '<option value="">' + esc(f.placeholder || "Please select…") + "</option>";
        f.choices.forEach(function (c) {
          opts += '<option value="' + esc(c.value) + '"' + (v === c.value ? " selected" : "") + ">" + esc(c.label) + "</option>";
        });
        if (f.otherOption) opts += '<option value="' + OTHER + '"' + (other ? " selected" : "") + ">" + esc(f.otherOption.label) + "</option>";
        return '<select class="form__select"' + common + ">" + opts + "</select>" + otherInput(f, v);
      }

      case "radio":
      case "checkboxGroup":
      case "tags": {
        var multi = f.control !== "radio";
        var list = f.choices.map(function (c, i) {
          var on = multi ? Array.isArray(v) && v.indexOf(c.value) > -1 : v === c.value;
          return '<label class="form__check"><input type="' + (multi ? "checkbox" : "radio") + '"' + (multi ? " data-group" : "") +
            ' id="' + id + "-" + i + '" name="' + name + '" value="' + esc(c.value) + '"' + (on ? " checked" : "") + "><span>" + esc(c.label) + "</span></label>";
        }).join("");
        return list + otherInput(f, v);
      }

      case "file":
      case "signature": {
        var accept = f.validation && f.validation.accept ? ' accept="' + esc(f.validation.accept) + '"' : "";
        var multiple = f.validation && f.validation.fileLimit > 1 ? " multiple" : "";
        return '<label class="form__file" for="' + id + '"><span data-file-text>' + esc(f.buttonText || "Choose a file") + "</span>" +
          '<input type="file"' + common + accept + multiple + "></label>";
      }

      case "payment":
      case "appointment":
      case "address":
      case "unknown":
        return '<p class="form__hint">This part of the form isn\'t available on this page.</p>';

      default: {
        var type = INPUT_TYPES[f.control] || "text";
        var val = v == null ? "" : v;
        return '<input class="form__input" type="' + type + '"' + common + ph + ' value="' + esc(val) + '"' +
          (f.control === "email" ? ' autocomplete="email"' : "") + (f.control === "phone" ? ' autocomplete="tel"' : "") + ">";
      }
    }
  }

  function otherInput(f, v) {
    if (!f.otherOption) return "";
    var text = otherText(f, v);
    return '<div class="form__other" data-other-wrap="' + esc(f.target) + '"' + (text == null ? " hidden" : "") + ">" +
      '<input class="form__input" type="text" data-other-text name="' + esc(f.target) + '" value="' + esc(text || "") + '"' +
      ' placeholder="' + esc(f.otherOption.placeholder || "Please specify") + '"></div>';
  }

  function setBusy(busy) {
    if (!button) return;
    button.disabled = !!busy;
    if (busy) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
  }

  function showOutcome(outcome) {
    if (outcome.url) {
      if (outcome.newTab) window.open(outcome.url, "_blank", "noopener"); else window.location.assign(outcome.url);
      return;
    }
    showMessage(outcome.message || "Thank you. We have received your details.");
    if (outcome.durationSeconds) setTimeout(function () { window.location.reload(); }, outcome.durationSeconds * 1000);
  }

  function showMessage(text) {
    var box = document.createElement("div");
    box.className = "form__success" + (inline ? " form__success--inline" : "");
    box.setAttribute("role", "status");
    box.innerHTML = String(text).split("\n").map(function (line) { return "<p>" + esc(line) + "</p>"; }).join("");
    formEl.replaceWith(box);
  }

  function showUnavailable() {
    var text = formEl.getAttribute("data-wix-fallback") || "This form isn't available right now. Please try again later.";
    if (inline) {
      fieldsEl.innerHTML = "";
      extrasEl.innerHTML = '<p class="form__error">' + esc(text) + "</p>";
    } else {
      fieldsEl.innerHTML = '<p class="form__error">' + esc(text) + "</p>";
    }
    if (button) button.hidden = true;
  }
}
