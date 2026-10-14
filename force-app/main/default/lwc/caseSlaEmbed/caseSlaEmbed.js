import { LightningElement, api, wire } from "lwc";
import { getRecord, getFieldValue, updateRecord } from "lightning/uiRecordApi";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import CASE_ID from "@salesforce/schema/Case.Id";
import CASE_NUMBER from "@salesforce/schema/Case.CaseNumber";
import CASE_PRIORITY from "@salesforce/schema/Case.Priority";
import CASE_CREATED from "@salesforce/schema/Case.CreatedDate";

export default class CaseSlaEmbed extends LightningElement {
  @api recordId;
  appUrl = "https://lambent-nasturtium-fc6c74.netlify.app";
  caseRecord;

  constructor() {
    super();
    // Dotted event names cannot be bound in the template, and configuration
    // errors (like SAME_ORIGIN_SRC) fire before renderedCallback.
    // So listen on the template, in the capture phase, from the start.
    this.template.addEventListener("sf-embedding.component.error", this.handleError, true);
  }

  @wire(getRecord, {
    recordId: "$recordId",
    fields: [CASE_NUMBER, CASE_PRIORITY, CASE_CREATED]
  })
  wiredCase({ data }) {
    if (data) {
      this.caseRecord = data;
    }
  }

  // Passed to the app as props. A fresh plain object, so nothing proxied crosses into the iframe.
  get caseProps() {
    if (!this.caseRecord) {
      return undefined;
    }
    return {
      caseNumber: getFieldValue(this.caseRecord, CASE_NUMBER),
      priority: getFieldValue(this.caseRecord, CASE_PRIORITY),
      createdDate: getFieldValue(this.caseRecord, CASE_CREATED)
    };
  }

  handleError = (event) => {
    const { phase, code, message, retryable } = event.detail;
    console.error("[caseSlaEmbed]", phase, code, message, retryable);
  };

  handleEscalate = async () => {
    try {
      await updateRecord({
        fields: {
          [CASE_ID.fieldApiName]: this.recordId,
          [CASE_PRIORITY.fieldApiName]: "High"
        }
      });
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Case escalated",
          message: "Priority set to High.",
          variant: "success"
        })
      );
    } catch (error) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Could not escalate",
          message: error.body?.message ?? "Unknown error",
          variant: "error"
        })
      );
    }
  };
}
