import { Component, ElementRef, Input, ViewChild } from "@angular/core";
import type { AfterViewInit, OnChanges } from "@angular/core";

// Adapted from IQB Testcenter 19 TcSpeedChartComponent (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. Keep its intrinsic 300 x 240 canvas,
// logarithmic projections, grid labels and per-sequence dot plots. Iterate only
// labelled x ticks: the source walks every four bytes even for 64 MiB packages.
@Component({
  selector: "app-original-system-check-speed-chart", standalone: true,
  template: `<canvas #chart height="240" role="img" [attr.aria-label]="label"
    style="border: 1px solid silver; margin: 2px; width: 100%;"></canvas>`,
  styles: [":host { display: block; min-width: 0; }"]
})
export class OriginalSystemCheckSpeedChartComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) sizes: number[] = [];
  @Input({ required: true }) sequences: [number, number][][] = [];
  @Input() download = false;
  @Input({ required: true }) label = "";
  @ViewChild("chart") private canvas!: ElementRef<HTMLCanvasElement>;
  private ready = false;
  private colors: string[] = [];

  ngAfterViewInit(): void { this.ready = true; this.draw(); }
  ngOnChanges(): void { if (this.ready) this.draw(); }

  private draw(): void {
    const canvas = this.canvas.nativeElement;
    const context = canvas.getContext("2d");
    if (!context || !this.sizes.length) return;
    const minX = Math.min(...this.sizes);
    const maxX = Math.max(...this.sizes) + 16;
    const minY = this.download ? 20 : 0;
    const maxY = this.download ? 1200 : 5000;
    const yStep = this.download ? 50 : 100;
    const project = (value: number): number => value === 0 ? 0 : Math.sign(value) * Math.log(Math.abs(value));
    const projectX = (value: number): number => value === 0 ? 0 : Math.sign(value) * Math.log2(Math.abs(value));
    const xScale = canvas.width / (projectX(maxX) - projectX(minX));
    const yScale = canvas.height / (project(maxY) - project(minY));
    const x = (value: number): number => xScale * (projectX(value) - projectX(minX));
    const y = (value: number): number => canvas.height - yScale * (project(value) - project(minY));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 1;
    context.fillStyle = "black";
    context.strokeStyle = "black";
    context.font = "10px sans-serif";
    for (const size of [...new Set(this.sizes)]) {
      if (size % 4 !== 0) continue;
      const index = Math.floor(Math.log(size) / Math.log(1024));
      context.fillText(`${(size / 1024 ** index).toFixed(2)} ${["B", "KiB", "MiB", "GiB"][index]}`, x(size), canvas.height - 4);
      context.beginPath(); context.moveTo(x(size), 0); context.lineTo(x(size), canvas.height); context.stroke();
    }
    for (let value = 0, index = 1; value < maxY; value += yStep, index += 1) {
      context.fillText(index < 10 ? `${value / 1000} sec` : " ", 4, y(value));
      context.beginPath(); context.moveTo(0, y(value)); context.lineTo(canvas.width, y(value)); context.stroke();
    }
    if (!this.sequences.length) this.colors = [];
    this.sequences.forEach((points, index) => {
      this.colors[index] ??= `rgb(${Array.from({ length: 3 }, () => Math.round(256 * Math.random())).join(", ")})`;
      context.fillStyle = this.colors[index];
      for (const [size, duration] of points) {
        context.beginPath(); context.arc(x(size), y(duration), 5, 0, 2 * Math.PI); context.fill();
      }
    });
  }
}
