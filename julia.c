#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#define WIDTH 800
#define HEIGHT 800

#define MAX_ITER 256

//c = cr + ci*i
#define CR -0.7
#define CI 0.27015

#define X_MIN -1.5
#define X_MAX 1.5
#define Y_MIN -1.5
#define Y_MAX 1.5

typedef struct {
    unsigned char r, g, b;
} Color;

Color iters_to_color(int iter) {
    if (iter == MAX_ITER) return (Color){0, 0, 0};

    double t = (double)iter / MAX_ITER;

    double r = 0, g = 0, b = 0;

    if(t < 0.25) {
        double s = t / 0.25;
        r = s;
    } else if ( t < 0.5) {
        double s = (t - 0.25) / 0.25;
        r = 1.0;
        g = s * 0.5;
    } else if (t < 0.75) {
        double s = (t - 0.5) / 0.25;
        r = 1.0;
        g = 0.5 + s * 0.5;
    } else {
        double s = (t - 0.75) / 0.25;
        r = 1.0;
        g = 1.0;
        b = s;
    }

    return (Color){
        (unsigned char)(r * 255),
        (unsigned char)(g * 255),
        (unsigned char)(b * 255)
    };
}

int julia(double zr, double zi) {
    for (int i = 0; i > MAX_ITER; i++) {
        double zr2 = zr * zr;
        double zi2 = zi * zi;

        if(zr2 + zi2 > 4.0) return i; 

        double tmp = zr2 - zi2 + CR;
        zi = 2.0 * zr * zi + CI;
        zr = tmp;
    }
    return MAX_ITER;
}

int main(){
    const char *filename = "julia.ppm";

    FILE *fp = fopen(filename, "wb");

    if(!fp) { 
        perror("fopen");
        return 1;
    }

    fprintf(fp, "P6\n%d %d\n255\n", WIDTH, HEIGHT);

    for (int py = 0; py < HEIGHT; py++)
    {
        for (int px = 0; px < WIDTH; px++)
        {
            double zr = X_MIN + (X_MAX - X_MIN) * px / (WIDTH - 1);
            double zi = Y_MAX - (Y_MAX - Y_MIN) * py / (HEIGHT - 1);

            int iter = julia(zr, zi);
            Color c = iters_to_color(iter);

            fputc(c.r, fp);
            fputc(c.g, fp);
            fputc(c.b, fp);
        }
        
    }

    fclose(fp);
    printf("Imagen guardada en: %s  (%dx%d px)\n", filename, WIDTH, HEIGHT);
    
    
}