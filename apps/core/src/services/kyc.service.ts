import axios, { Axios } from "axios";
import FormData from "form-data";
import { AbstractService } from "./service";
import { ENV } from "../injector/tokens/env.token";
import { type AppEnvironment } from "../constants";
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class KYCService extends AbstractService {
  private static BASE_URL = 'https://api.kycaid.com';
  private _api?: Axios;

  constructor(
    @Inject(ENV) private env: AppEnvironment
  ) {
    super();
  }

  private get api() {
    if (!this._api) {
      this._api = axios.create({
        baseURL: KYCService.BASE_URL,
        headers: {
          'Authorization': `Token ${this.env.KYC_TOKEN}`,
        },
      });
    }

    return this._api;
  }

  // Create an applicant
  async createApplicant(applicantData: {
    type: string
    first_name: string
    last_name: string
    dob: string
    residence_country: string
    email: string
  }): Promise<{ applicant_id: string }> {
    const response = await this.api.post('/applicants', applicantData)
    return response.data
  }

  // Upload a file
  async uploadFile(file: Buffer, name: string): Promise<{ file_id: string }> {
    const formData = new FormData();
    formData.append('file', file, { 
      filename: name, 
      contentType: 'image/jpeg'  // Explicitly specify MIME type if needed
  });

    const response = await this.api.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...formData.getHeaders()
      },
    });

    return response.data;
  }

  // Create an applicant document
  async createApplicantDocument(documentData: {
    applicant_id: string
    document_number?: string
    issue_date?: string
    expiry_date?: string
    front_side_id: string
    back_side_id?: string
    type:
    'GOVERNMENT_ID' |
    'PASSPORT' |
    'DRIVERS_LICENSE' |
    'DOMESTIC_PASSPORT' |
    'PERMANENT_RESIDENCE_PERMIT' |
    'REFUGEE_CARD' |
    'FOREIGN_CITIZEN_PASSPORT' |
    'SELFIE_IMAGE' |
    'SELFIE_WITH_DOCUMENT' |
    'SELFIE_WITH_CREDIT_CARD' |
    'ADDRESS_DOCUMENT' |
    'FINANCIAL_DOCUMENT' |
    'TAX_ID_NUMBER' |
    'CREDIT_CARD' |
    'BANK_STATEMENT' |
    'REGISTRATION_COMPANY' |
    'COMPANY_LEGAL_ADDRESS' |
    'AUTHORISED_PERSON' |
    'COMPANY_OWNERSHIP' |
    'VIDEO'
  }): Promise<{ document_id: string }> {
    const response = await this.api.post('/documents', documentData)
    return response.data
  }

  // Create a verification request
  async createVerification(verificationData: {
    applicant_id: string
    form_id: string
  }): Promise<{ verification_id: string }> {
    const response = await this.api.post('/verifications', verificationData)
    return response.data
  }
}