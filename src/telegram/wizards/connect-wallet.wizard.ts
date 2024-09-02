import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, map } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

@Injectable()
export class WalletPayService {
  private readonly baseUrl = 'https://api.walletpay.com'; // Replace with actual Wallet Pay API base URL
  private readonly apiKey = 'your-wallet-pay-api-key'; // Replace with your actual Wallet Pay API key

  constructor(private readonly httpService: HttpService) {}

  private handleError(error: any): Observable<never> {
    return throwError(
      new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.response?.data || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR),
    );
  }

  getWalletBalance(userId: string): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/wallets/${userId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    }).pipe(
      map(response => response.data),
      catchError(this.handleError),
    );
  }

  createTransaction(transactionDetails: any): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/transactions`, transactionDetails, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    }).pipe(
      map(response => response.data),
      catchError(this.handleError),
    );
  }

  // Add more methods as required by the Wallet Pay API
}
