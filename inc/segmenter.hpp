﻿#ifndef __SEGMENTOR_H
#define __SEGMENTOR_H

#include "trianglemesh.hpp"
#include <vector>

class Segmenter {
  protected:
    TriangleMesh* mesh;
    float tolerance;

  public:
    Segmenter(TriangleMesh* mesh, float tolerance = 0.0f)
        : mesh(mesh), tolerance(tolerance) {
    }
    virtual std::vector<TriangleMesh*> do_segmentation() = 0;
};

#endif