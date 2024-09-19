import axios, { Axios } from "axios";
import { env } from "../constants";
import { ENVIRONMENT_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";

@Injectable()
export class KYCService {
  @Autowire(ENVIRONMENT_TOKEN)
  private _env: typeof env

  private _api: Axios;

  private get api() {
    if (!this._api) {
      this._api = axios.create({
        baseURL: 'https://api.eu.onfido.com/v3.6',
        headers: {
          'Authorization': `Token token=${this._env.ONFIDO_TOKEN}`,
          'Accept': 'application/json',
        },
      });
    }

    return this._api;
  }

  async createApplicant(data: {
    first_name: string,
    last_name: string,
    dob: string,
    address: {
      building_number: string,
      street: string,
      town: string,
      postcode: string,
      country: string
    }
  }): Promise<{ id: string }> {
    try {
      const response = await this.api.post('/applicants', data);
      return response.data;
    } catch (error) {
      throw new Error('Failed to create applicant');
    }
  }

  async createWorkflowRun(data: {
    workflow_id: string,
    applicant_id: string
  }): Promise<{ id: string }> {
    try {
      const response = await this.api.post(`/workflow_runs`, data);
      return response.data;
    } catch (error) {
      throw new Error('Failed to start workflow');
    }
  }
}