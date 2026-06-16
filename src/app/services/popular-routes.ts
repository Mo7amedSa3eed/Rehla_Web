import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './api';

export interface PopularRoute {
  originGovAr: string;
  originGovEn: string;
  destinationGovAr: string;
  destinationGovEn: string;
}

@Injectable({ providedIn: 'root' })
export class PopularRoutesService {
  private readonly apiUrl = 'https://rehlabussines2-001-site1.anytempurl.com/api/Search/popular-routes';

  constructor(private http: HttpClient) {}

  getPopularRoutes(): Observable<ApiResponse<PopularRoute[]>> {
    return this.http.get<ApiResponse<PopularRoute[]>>(this.apiUrl);
  }
}
