import { Component, type OnInit } from '@angular/core';
import {
  AsyncPipe, NgSwitch, NgSwitchCase
} from '@angular/common';
import {MatCard,MatCardHeader,MatCardTitle,MatCardContent} from '@angular/material/card';
import {
  AlertComponent, CustomtextPipe, MainDataService
} from '../../../shared/shared.module';
import { TestControllerService } from '../../index';

@Component({
  templateUrl: './test-status.component.html',
  imports: [
    NgSwitch,
    MatCard,MatCardHeader,MatCardTitle,MatCardContent,
    AsyncPipe,
    CustomtextPipe,
    NgSwitchCase,
    AlertComponent
  ],
  styleUrls: ['./test-status.component.css']
})

export class TestStatusComponent implements OnInit {
  loginName = '??';

  constructor(
    public tcs: TestControllerService,
    public mainDataService: MainDataService) { }

  ngOnInit(): void {
    setTimeout(() => {
      const authData = this.mainDataService.getAuthData();
      if (authData) {
        this.loginName = authData.displayName;
      }
    });
  }
}
